import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { eventBudgetLines, eventExpenses, eventProfessionals, professionals } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { computeBudgetSummary, toCsv, type BudgetSummary } from "@/modules/events/domain/budget";

export const budgetLineSchema = z.object({
  category: z.string().trim().min(1, "Catégorie requise.").max(80),
  label: z.string().trim().min(1, "Libellé requis.").max(160),
  plannedCents: z.number().int().min(0).max(1_000_000_000),
  eventProfessionalId: z.uuid().nullable().optional(),
});
export const expenseSchema = z.object({
  budgetLineId: z.uuid().nullable().optional(),
  label: z.string().trim().min(1, "Libellé requis.").max(160),
  amountCents: z.number().int().min(0).max(1_000_000_000),
  status: z.enum(["planned", "committed", "paid"]).default("committed"),
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  receiptFileId: z.uuid().nullable().optional(),
});

export type BudgetView = {
  summary: BudgetSummary;
  expenses: Array<typeof eventExpenses.$inferSelect & { lineLabel: string | null }>;
  providers: Array<{ id: string; label: string; quoteCents: number | null; status: string }>;
};

export async function getBudget(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<BudgetView & { canManage: boolean }> {
  const access = await requireEventPermission(actor, eventId, "event.budget.view", executor);
  const lines = await executor.select().from(eventBudgetLines).where(eq(eventBudgetLines.eventId, eventId)).orderBy(asc(eventBudgetLines.sortOrder), asc(eventBudgetLines.createdAt));
  const expenses = await executor.select().from(eventExpenses).where(eq(eventExpenses.eventId, eventId)).orderBy(asc(eventExpenses.createdAt));
  const providerRows = await executor
    .select({ id: eventProfessionals.id, externalName: eventProfessionals.externalName, proName: professionals.displayName, quoteCents: eventProfessionals.quoteCents, status: eventProfessionals.status })
    .from(eventProfessionals)
    .leftJoin(professionals, eq(professionals.id, eventProfessionals.professionalId))
    .where(eq(eventProfessionals.eventId, eventId));
  const lineLabel = new Map(lines.map((l) => [l.id, l.label]));
  return {
    summary: computeBudgetSummary(lines, expenses),
    expenses: expenses.map((e) => ({ ...e, lineLabel: e.budgetLineId ? (lineLabel.get(e.budgetLineId) ?? null) : null })),
    providers: providerRows.filter((p) => p.proName || p.externalName).map((p) => ({ id: p.id, label: p.proName ?? p.externalName ?? "", quoteCents: p.quoteCents, status: p.status })),
    canManage: access.permissions.has("event.budget.manage"),
  };
}

export async function createBudgetLine(actor: Actor, eventId: string, raw: unknown, executor: DbExecutor = db): Promise<{ id: string }> {
  await requireEventPermission(actor, eventId, "event.budget.manage", executor);
  const parsed = budgetLineSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Ligne invalide.", { issues: parsed.error.issues });
  if (parsed.data.eventProfessionalId) await assertProvider(eventId, parsed.data.eventProfessionalId, executor);
  const [row] = await executor
    .insert(eventBudgetLines)
    .values({ eventId, category: parsed.data.category, label: parsed.data.label, plannedCents: parsed.data.plannedCents, eventProfessionalId: parsed.data.eventProfessionalId ?? null })
    .returning({ id: eventBudgetLines.id });
  if (!row) throw new Error("budget line insert failed");
  return row;
}

async function assertProvider(eventId: string, providerId: string, executor: DbExecutor) {
  const [p] = await executor.select({ id: eventProfessionals.id }).from(eventProfessionals).where(and(eq(eventProfessionals.id, providerId), eq(eventProfessionals.eventId, eventId))).limit(1);
  if (!p) throw new ValidationError("Prestataire inconnu pour cet évènement.");
}

export async function updateBudgetLine(actor: Actor, eventId: string, lineId: string, raw: unknown, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.budget.manage", executor);
  const [line] = await executor.select({ id: eventBudgetLines.id }).from(eventBudgetLines).where(and(eq(eventBudgetLines.id, lineId), eq(eventBudgetLines.eventId, eventId))).limit(1);
  if (!line) throw new NotFoundError();
  const parsed = budgetLineSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Ligne invalide.", { issues: parsed.error.issues });
  if (parsed.data.eventProfessionalId) await assertProvider(eventId, parsed.data.eventProfessionalId, executor);
  await executor
    .update(eventBudgetLines)
    .set({ category: parsed.data.category, label: parsed.data.label, plannedCents: parsed.data.plannedCents, eventProfessionalId: parsed.data.eventProfessionalId ?? null })
    .where(eq(eventBudgetLines.id, lineId));
}

export async function deleteBudgetLine(actor: Actor, eventId: string, lineId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.budget.manage", executor);
  const [line] = await executor.select({ id: eventBudgetLines.id }).from(eventBudgetLines).where(and(eq(eventBudgetLines.id, lineId), eq(eventBudgetLines.eventId, eventId))).limit(1);
  if (!line) throw new NotFoundError();
  await executor.delete(eventBudgetLines).where(eq(eventBudgetLines.id, lineId));
}

export async function createExpense(actor: Actor, eventId: string, raw: unknown, executor: DbExecutor = db): Promise<{ id: string }> {
  await requireEventPermission(actor, eventId, "event.budget.manage", executor);
  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Dépense invalide.", { issues: parsed.error.issues });
  if (parsed.data.budgetLineId) {
    const [line] = await executor.select({ id: eventBudgetLines.id }).from(eventBudgetLines).where(and(eq(eventBudgetLines.id, parsed.data.budgetLineId), eq(eventBudgetLines.eventId, eventId))).limit(1);
    if (!line) throw new ValidationError("Ligne de budget inconnue.");
  }
  const [row] = await executor
    .insert(eventExpenses)
    .values({
      eventId,
      budgetLineId: parsed.data.budgetLineId ?? null,
      label: parsed.data.label,
      amountCents: parsed.data.amountCents,
      status: parsed.data.status,
      paidAt: parsed.data.status === "paid" ? (parsed.data.paidAt ?? new Date().toISOString().slice(0, 10)) : null,
      receiptFileId: parsed.data.receiptFileId ?? null,
    })
    .returning({ id: eventExpenses.id });
  if (!row) throw new Error("expense insert failed");
  return row;
}

export async function updateExpense(actor: Actor, eventId: string, expenseId: string, raw: unknown, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.budget.manage", executor);
  const [current] = await executor.select().from(eventExpenses).where(and(eq(eventExpenses.id, expenseId), eq(eventExpenses.eventId, eventId))).limit(1);
  if (!current) throw new NotFoundError();
  const parsed = expenseSchema.partial().safeParse(raw);
  if (!parsed.success) throw new ValidationError("Dépense invalide.", { issues: parsed.error.issues });
  const d = parsed.data;
  if (d.budgetLineId) {
    const [line] = await executor.select({ id: eventBudgetLines.id }).from(eventBudgetLines).where(and(eq(eventBudgetLines.id, d.budgetLineId), eq(eventBudgetLines.eventId, eventId))).limit(1);
    if (!line) throw new ValidationError("Ligne de budget inconnue.");
  }
  const status = d.status ?? current.status;
  await executor
    .update(eventExpenses)
    .set({
      budgetLineId: d.budgetLineId === undefined ? current.budgetLineId : d.budgetLineId,
      label: d.label ?? current.label,
      amountCents: d.amountCents ?? current.amountCents,
      status,
      paidAt: status === "paid" ? (d.paidAt ?? current.paidAt ?? new Date().toISOString().slice(0, 10)) : null,
      receiptFileId: d.receiptFileId === undefined ? current.receiptFileId : d.receiptFileId,
    })
    .where(eq(eventExpenses.id, expenseId));
}

export async function deleteExpense(actor: Actor, eventId: string, expenseId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.budget.manage", executor);
  const [current] = await executor.select({ id: eventExpenses.id }).from(eventExpenses).where(and(eq(eventExpenses.id, expenseId), eq(eventExpenses.eventId, eventId))).limit(1);
  if (!current) throw new NotFoundError();
  await executor.delete(eventExpenses).where(eq(eventExpenses.id, expenseId));
}

export async function budgetCsv(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<string> {
  const view = await getBudget(actor, eventId, executor);
  const rows: Array<Array<string | number | null>> = [["Type", "Catégorie", "Libellé", "Prévu (€)", "Engagé (€)", "Payé (€)", "Écart (€)", "Statut", "Payé le"]];
  for (const l of view.summary.lines) rows.push(["Ligne", l.category, l.label, l.plannedCents / 100, l.committedCents / 100, l.paidCents / 100, l.varianceCents / 100, "", ""]);
  for (const e of view.expenses) rows.push(["Dépense", "", e.label, "", e.status === "planned" ? 0 : e.amountCents / 100, e.status === "paid" ? e.amountCents / 100 : 0, "", e.status, e.paidAt]);
  rows.push(["Total", "", "", view.summary.plannedCents / 100, view.summary.committedCents / 100, view.summary.paidCents / 100, view.summary.remainingCents / 100, "", ""]);
  return toCsv(rows);
}
