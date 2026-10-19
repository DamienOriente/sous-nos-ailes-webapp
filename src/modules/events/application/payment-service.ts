import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventBudgetLines, eventExpenses, eventMembers, eventPaymentItems, eventProfessionals, events, inquiries, inquiryQuotes, professionalCategories, professionals } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { buildPaymentSchedule, paymentState, reminderDue } from "@/modules/events/domain/payment-schedule";
import { notify } from "@/modules/notifications/application/notification-service";
import { recordAudit } from "./audit";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const euros = (c: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(c / 100);
const ORGANIZER_ROLES = ["owner", "lead_organizer", "co_organizer", "wedding_planner"] as const;

/**
 * Accepted quote → budget (2026-10-19): the trade's budget line gets the quoted amount, a
 * committed expense is recorded and the deposit / balance schedule is created. Idempotent:
 * accepting twice (or a new quote version) never duplicates rows.
 */
export async function recordAcceptedQuoteInBudget(eventId: string, inquiryId: string, executor: DbExecutor): Promise<void> {
  const [row] = await executor
    .select({ inquiry: inquiries, proName: professionals.displayName, proId: professionals.id, categoryName: professionalCategories.name, eventDate: events.eventDate })
    .from(inquiries)
    .innerJoin(professionals, eq(professionals.id, inquiries.professionalId))
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .innerJoin(events, eq(events.id, inquiries.eventId))
    .where(and(eq(inquiries.id, inquiryId), eq(inquiries.eventId, eventId)))
    .limit(1);
  if (!row) throw new NotFoundError();
  const [quote] = await executor.select().from(inquiryQuotes).where(eq(inquiryQuotes.inquiryId, inquiryId)).orderBy(desc(inquiryQuotes.version)).limit(1);
  const total = quote?.totalCents ?? row.inquiry.quoteCents ?? 0;
  if (total <= 0) return;

  const [slot] = await executor.select({ id: eventProfessionals.id }).from(eventProfessionals).where(and(eq(eventProfessionals.eventId, eventId), eq(eventProfessionals.professionalId, row.proId))).limit(1);
  const lines = await executor.select().from(eventBudgetLines).where(eq(eventBudgetLines.eventId, eventId));
  // Same provider first, then an empty line of the trade (the template ones), else a new line.
  const line = lines.find((l) => slot && l.eventProfessionalId === slot.id) ?? lines.find((l) => l.label === row.proName) ?? lines.find((l) => l.category === row.categoryName && !l.eventProfessionalId);
  let lineId: string;
  if (line) {
    await executor.update(eventBudgetLines).set({ plannedCents: total, label: row.proName, eventProfessionalId: slot?.id ?? line.eventProfessionalId }).where(eq(eventBudgetLines.id, line.id));
    lineId = line.id;
  } else {
    const [created] = await executor.insert(eventBudgetLines).values({ eventId, category: row.categoryName, label: row.proName, plannedCents: total, eventProfessionalId: slot?.id ?? null, sortOrder: 500 }).returning({ id: eventBudgetLines.id });
    lineId = created!.id;
  }
  if (slot) await executor.update(eventProfessionals).set({ quoteCents: total }).where(eq(eventProfessionals.id, slot.id));

  const label = `Devis accepté : ${row.proName}`;
  const [expense] = await executor.select({ id: eventExpenses.id }).from(eventExpenses).where(and(eq(eventExpenses.eventId, eventId), eq(eventExpenses.label, label))).limit(1);
  if (expense) await executor.update(eventExpenses).set({ amountCents: total, budgetLineId: lineId }).where(eq(eventExpenses.id, expense.id));
  else await executor.insert(eventExpenses).values({ eventId, budgetLineId: lineId, label, amountCents: total, status: "committed" });

  const schedule = buildPaymentSchedule({ totalCents: total, depositCents: quote?.depositCents ?? 0, balanceDueDays: quote?.balanceDueDays ?? null, eventDate: row.eventDate, acceptedOn: today() });
  for (const p of schedule) {
    await executor
      .insert(eventPaymentItems)
      .values({ eventId, budgetLineId: lineId, inquiryId, payeeName: row.proName, kind: p.kind, label: p.label, amountCents: p.amountCents, dueDate: p.dueDate })
      .onConflictDoUpdate({ target: [eventPaymentItems.inquiryId, eventPaymentItems.kind], set: { amountCents: p.amountCents, dueDate: p.dueDate, label: p.label, budgetLineId: lineId } });
  }
}

export async function listPaymentItems(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const access = await requireEventPermission(actor, eventId, "event.budget.view", executor);
  const rows = await executor.select().from(eventPaymentItems).where(eq(eventPaymentItems.eventId, eventId)).orderBy(asc(eventPaymentItems.dueDate), asc(eventPaymentItems.payeeName));
  const day = today();
  const items = rows.map((r) => ({ ...r, state: paymentState(r, day) }));
  const remaining = items.filter((i) => !i.paidAt).reduce((s, i) => s + i.amountCents, 0);
  return { items, remainingCents: remaining, canManage: access.permissions.has("event.budget.manage") };
}

/** The organiser records a payment made directly to the provider. */
export async function markPaymentPaid(actor: Actor, eventId: string, itemId: string, paidOn: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    await requireEventPermission(actor, eventId, "event.budget.manage", tx);
    const [item] = await tx.select().from(eventPaymentItems).where(and(eq(eventPaymentItems.id, itemId), eq(eventPaymentItems.eventId, eventId))).limit(1);
    if (!item) throw new NotFoundError();
    if (paidOn && !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) throw new ValidationError("Date invalide.");
    await tx.update(eventPaymentItems).set({ paidAt: paidOn ? paidOn : null }).where(eq(eventPaymentItems.id, itemId));
    if (item.inquiryId) {
      const siblings = await tx.select({ paidAt: eventPaymentItems.paidAt, id: eventPaymentItems.id }).from(eventPaymentItems).where(eq(eventPaymentItems.inquiryId, item.inquiryId));
      const allPaid = siblings.every((s) => (s.id === itemId ? Boolean(paidOn) : Boolean(s.paidAt)));
      await tx.update(eventExpenses).set({ status: allPaid ? "paid" : "committed", paidAt: allPaid ? paidOn : null }).where(and(eq(eventExpenses.eventId, eventId), eq(eventExpenses.label, `Devis accepté : ${item.payeeName}`)));
    }
    await recordAudit({ actorUserId: actor.userId, action: paidOn ? "payment.marked_paid" : "payment.marked_unpaid", resourceType: "payment_item", resourceId: itemId, eventId }, tx);
  });
}

/** Daily: reminds organisers a week before, on the day and the day after an unpaid due date. */
export async function remindUpcomingPayments(executor: DbExecutor = db): Promise<number> {
  const day = today();
  const open = await executor
    .select({ item: eventPaymentItems, eventName: events.name })
    .from(eventPaymentItems)
    .innerJoin(events, eq(events.id, eventPaymentItems.eventId))
    .where(and(isNull(eventPaymentItems.paidAt), isNull(events.deletedAt)));
  const due = open.map((o) => ({ ...o, when: reminderDue(o.item, day) })).filter((o) => o.when);
  if (!due.length) return 0;
  const eventIds = [...new Set(due.map((d) => d.item.eventId))];
  const organisers = await executor
    .select({ eventId: eventMembers.eventId, userId: eventMembers.userId })
    .from(eventMembers)
    .where(and(inArray(eventMembers.eventId, eventIds), eq(eventMembers.status, "active"), inArray(eventMembers.role, [...ORGANIZER_ROLES])));
  let sent = 0;
  for (const d of due) {
    const title = d.when === "week_before" ? `Paiement dans 7 jours : ${d.item.payeeName}` : d.when === "due_today" ? `Paiement à faire aujourd'hui : ${d.item.payeeName}` : `Paiement en retard : ${d.item.payeeName}`;
    const body = `${d.item.label} de ${euros(d.item.amountCents)} pour « ${d.eventName} ». Le règlement se fait directement auprès du professionnel ; marquez-le payé dans le budget.`;
    for (const o of organisers.filter((x) => x.eventId === d.item.eventId)) {
      await notify({ userId: o.userId, type: "deadline", title, body, href: `/app/evenements/${d.item.eventId}/budget#echeancier`, eventId: d.item.eventId, dedupeKey: `payment:${d.item.id}:${d.when}`, email: "always" }, executor);
      sent += 1;
    }
    await executor.update(eventPaymentItems).set({ remindedAt: new Date() }).where(eq(eventPaymentItems.id, d.item.id));
  }
  return sent;
}
