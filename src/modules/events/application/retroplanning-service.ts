import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventProfessionals, eventTasks, events, inquiries, professionalCategories, professionalHolds, professionals } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { buildRetroplanning, type RetroItem } from "@/modules/events/domain/retroplanning";
import { recordAudit } from "./audit";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
export const RETRO_SECTION = "Réservations";

/** Where each trade stands for this event: confirmed provider = booked; slot, inquiry or option = in progress. */
async function bookingProgress(eventId: string, executor: DbExecutor): Promise<Map<string, "booked" | "in_progress">> {
  const progress = new Map<string, "booked" | "in_progress">();
  const set = (slug: string | null, state: "booked" | "in_progress") => {
    if (!slug) return;
    if (state === "booked" || !progress.has(slug)) progress.set(slug, state);
  };
  const slots = await executor
    .select({ status: eventProfessionals.status, slotSlug: professionalCategories.slug, proCategoryId: professionals.primaryCategoryId })
    .from(eventProfessionals)
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventProfessionals.categoryId))
    .leftJoin(professionals, eq(professionals.id, eventProfessionals.professionalId))
    .where(eq(eventProfessionals.eventId, eventId));
  const catIds = [...new Set(slots.map((s) => s.proCategoryId).filter((x): x is string => Boolean(x)))];
  const catSlug = new Map((catIds.length ? await executor.select({ id: professionalCategories.id, slug: professionalCategories.slug }).from(professionalCategories).where(inArray(professionalCategories.id, catIds)) : []).map((c) => [c.id, c.slug]));
  for (const s of slots) {
    const slug = s.slotSlug ?? (s.proCategoryId ? (catSlug.get(s.proCategoryId) ?? null) : null);
    if (s.status === "confirmed") set(slug, "booked");
    else if (s.status !== "cancelled" && s.status !== "declined") set(slug, "in_progress");
  }
  const inq = await executor
    .select({ status: inquiries.status, slug: professionalCategories.slug })
    .from(inquiries)
    .innerJoin(professionals, eq(professionals.id, inquiries.professionalId))
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(eq(inquiries.eventId, eventId));
  for (const i of inq) {
    if (i.status === "confirmed") set(i.slug, "booked");
    else if (i.status !== "declined" && i.status !== "archived") set(i.slug, "in_progress");
  }
  const holds = await executor
    .select({ slug: professionalCategories.slug })
    .from(professionalHolds)
    .innerJoin(professionals, eq(professionals.id, professionalHolds.professionalId))
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(and(eq(professionalHolds.eventId, eventId), sql`(${professionalHolds.status} = 'confirmed' or (${professionalHolds.status} = 'active' and ${professionalHolds.expiresAt} > now()))`));
  for (const h of holds) set(h.slug, "in_progress");
  return progress;
}

export type RetroplanningView = { eventDate: string | null; eventType: string; department: string | null; items: (RetroItem & { categoryName: string; hasTask: boolean })[]; canAddTasks: boolean };

export async function getRetroplanning(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<RetroplanningView> {
  const access = await requireEventPermission(actor, eventId, "event.inquiries.view", executor);
  const [e] = await executor.select({ type: events.type, eventDate: events.eventDate, department: events.department }).from(events).where(and(eq(events.id, eventId), isNull(events.deletedAt))).limit(1);
  if (!e) throw new NotFoundError();
  if (!e.eventDate) return { eventDate: null, eventType: e.type, department: e.department, items: [], canAddTasks: false };
  const progress = await bookingProgress(eventId, executor);
  const items = buildRetroplanning(e.type, e.eventDate, today(), progress);
  const names = new Map((await executor.select({ slug: professionalCategories.slug, name: professionalCategories.name }).from(professionalCategories).where(inArray(professionalCategories.slug, items.map((i) => i.categorySlug)))).map((c) => [c.slug, c.name]));
  const tasks = await executor.select({ title: eventTasks.title }).from(eventTasks).where(and(eq(eventTasks.eventId, eventId), eq(eventTasks.section, RETRO_SECTION)));
  const titles = new Set(tasks.map((t) => t.title));
  return {
    eventDate: e.eventDate,
    eventType: e.type,
    department: e.department,
    items: items.map((i) => ({ ...i, categoryName: names.get(i.categorySlug) ?? i.categorySlug, hasTask: titles.has(i.label) })),
    canAddTasks: access.permissions.has("event.tasks.manage"),
  };
}

/** Turns the bookings still to do into dated tasks (idempotent: one task per booking). */
export async function addRetroplanningTasks(actor: Actor, eventId: string): Promise<{ created: number }> {
  return db.transaction(async (tx) => {
    await requireEventPermission(actor, eventId, "event.tasks.manage", tx);
    const view = await getRetroplanning(actor, eventId, tx);
    if (!view.eventDate) throw new ValidationError("Fixez d'abord la date de l'évènement.");
    const todo = view.items.filter((i) => i.state !== "booked" && !i.hasTask);
    if (todo.length) {
      const day = today();
      await tx.insert(eventTasks).values(
        todo.map((i, n) => ({
          eventId,
          title: i.label,
          description: i.why,
          section: RETRO_SECTION,
          // A booking already late gets today as due date: it shows on top, not lost in the past.
          dueDate: i.targetDate < day ? day : i.targetDate,
          priority: i.state === "late" || i.state === "now" ? ("high" as const) : ("normal" as const),
          sortOrder: 900 + n,
          createdByUserId: actor.userId,
        })),
      );
    }
    await recordAudit({ actorUserId: actor.userId, action: "event.retroplanning_tasks", resourceType: "event", resourceId: eventId, eventId, metadata: { created: todo.length } }, tx);
    return { created: todo.length };
  });
}
