import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { eventMembers, eventMilestones, events, professionalCategories } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { getEventWithPermission, zonedDateTimeToUtc } from "@/modules/events/application/event-service";
import { buildIcsCalendar, type IcsEvent } from "@/modules/events/infrastructure/ics";
import { MILESTONE_TEMPLATES } from "@/modules/events/domain/suggestions";
import { notify } from "@/modules/notifications/application/notification-service";

/**
 * Adds the classic moments of the event type (real rows), skipping titles that
 * already exist. Requires a known date; providers of the concerned trades are
 * notified once.
 */
export async function addSuggestedMilestones(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<{ created: number }> {
  const event = await getEventWithPermission(actor, eventId, "event.milestones.manage", executor);
  if (!event.eventDate) throw new ValidationError("Fixez d'abord la date de l'évènement dans les paramètres.");
  const existing = await executor.select({ title: eventMilestones.title }).from(eventMilestones).where(eq(eventMilestones.eventId, eventId));
  const titles = new Set(existing.map((m) => m.title.trim().toLowerCase()));
  const rows = MILESTONE_TEMPLATES[event.type]
    .filter((t) => !titles.has(t.title.toLowerCase()))
    .map((t, i) => {
      const { startsAt, endsAt } = toUtc({ title: t.title, date: event.eventDate!, startTime: t.start, endTime: t.end ?? null, categorySlugs: t.categorySlugs }, event.timezone);
      return { eventId, title: t.title, description: t.description ?? null, startsAt, endsAt, location: t.location ?? null, categorySlugs: t.categorySlugs, sortOrder: existing.length + i };
    });
  if (rows.length === 0) return { created: 0 };
  await executor.insert(eventMilestones).values(rows);
  const slugs = [...new Set(rows.flatMap((r) => r.categorySlugs))];
  await notifyConcernedProviders(actor, eventId, { id: eventId, title: `${rows.length} étapes du jour J`, categorySlugs: slugs }, "created", executor);
  return { created: rows.length };
}

export const milestoneSchema = z.object({
  title: z.string().trim().min(2, "Titre trop court.").max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  /** Local date + time in the event timezone. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide."),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  location: z.string().trim().max(160).nullable().optional(),
  categorySlugs: z.array(z.string().trim().min(1)).max(24).default([]),
});
export type MilestoneInput = z.infer<typeof milestoneSchema>;

export type MilestoneRow = typeof eventMilestones.$inferSelect;

export async function listMilestones(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const event = await getEventWithPermission(actor, eventId, "event.milestones.view", executor);
  const rows = await executor.select().from(eventMilestones).where(eq(eventMilestones.eventId, eventId)).orderBy(asc(eventMilestones.startsAt), asc(eventMilestones.sortOrder));
  return { event, milestones: rows };
}

function toUtc(input: MilestoneInput, timezone: string) {
  const startsAt = zonedDateTimeToUtc(input.date, input.startTime, timezone);
  let endsAt: Date | null = null;
  if (input.endTime) {
    endsAt = zonedDateTimeToUtc(input.date, input.endTime, timezone);
    // Past midnight (e.g. 22:30 → 01:00): roll to the next day.
    if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86_400_000);
  }
  return { startsAt, endsAt };
}

/** Providers/staff whose trade is concerned by the milestone (or every provider when no category is set). */
async function notifyConcernedProviders(actor: Actor, eventId: string, milestone: { id: string; title: string; categorySlugs: string[] }, kind: "created" | "updated" | "deleted", executor: DbExecutor) {
  const members = await executor
    .select({ userId: eventMembers.userId, categorySlug: professionalCategories.slug, role: eventMembers.role })
    .from(eventMembers)
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventMembers.categoryId))
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, "active"), inArray(eventMembers.role, ["provider", "staff", "collaborator"])));
  const targets = members.filter((m) => m.userId !== actor.userId && (milestone.categorySlugs.length === 0 || (m.categorySlug && milestone.categorySlugs.includes(m.categorySlug))));
  const verb = kind === "created" ? "ajouté au" : kind === "deleted" ? "retiré du" : "modifié dans le";
  for (const t of targets) {
    await notify(
      {
        userId: t.userId,
        type: "schedule_changed",
        title: "Le planning du jour J a changé",
        body: `« ${milestone.title} » a été ${verb} planning.`,
        href: `/app/evenements/${eventId}/planning`,
        eventId,
        dedupeKey: `schedule:${eventId}:${t.userId}`,
      },
      executor,
    );
  }
}

export async function createMilestone(actor: Actor, eventId: string, raw: unknown, executor: DbExecutor = db): Promise<{ id: string }> {
  const event = await getEventWithPermission(actor, eventId, "event.milestones.manage", executor);
  const parsed = milestoneSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Étape invalide.", { issues: parsed.error.issues });
  const { startsAt, endsAt } = toUtc(parsed.data, event.timezone);
  const [row] = await executor
    .insert(eventMilestones)
    .values({ eventId, title: parsed.data.title, description: parsed.data.description ?? null, startsAt, endsAt, location: parsed.data.location ?? null, categorySlugs: parsed.data.categorySlugs })
    .returning({ id: eventMilestones.id });
  if (!row) throw new Error("milestone insert failed");
  await notifyConcernedProviders(actor, eventId, { id: row.id, title: parsed.data.title, categorySlugs: parsed.data.categorySlugs }, "created", executor);
  return row;
}

export async function updateMilestone(actor: Actor, eventId: string, milestoneId: string, raw: unknown, executor: DbExecutor = db): Promise<void> {
  const event = await getEventWithPermission(actor, eventId, "event.milestones.manage", executor);
  const [current] = await executor.select().from(eventMilestones).where(and(eq(eventMilestones.id, milestoneId), eq(eventMilestones.eventId, eventId))).limit(1);
  if (!current) throw new NotFoundError();
  const parsed = milestoneSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Étape invalide.", { issues: parsed.error.issues });
  const { startsAt, endsAt } = toUtc(parsed.data, event.timezone);
  await executor
    .update(eventMilestones)
    .set({ title: parsed.data.title, description: parsed.data.description ?? null, startsAt, endsAt, location: parsed.data.location ?? null, categorySlugs: parsed.data.categorySlugs })
    .where(eq(eventMilestones.id, milestoneId));
  const slugs = [...new Set([...current.categorySlugs, ...parsed.data.categorySlugs])];
  await notifyConcernedProviders(actor, eventId, { id: milestoneId, title: parsed.data.title, categorySlugs: slugs }, "updated", executor);
}

export async function deleteMilestone(actor: Actor, eventId: string, milestoneId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.milestones.manage", executor);
  const [current] = await executor.select().from(eventMilestones).where(and(eq(eventMilestones.id, milestoneId), eq(eventMilestones.eventId, eventId))).limit(1);
  if (!current) throw new NotFoundError();
  await executor.delete(eventMilestones).where(eq(eventMilestones.id, milestoneId));
  await notifyConcernedProviders(actor, eventId, { id: milestoneId, title: current.title, categorySlugs: current.categorySlugs }, "deleted", executor);
}

/** ICS of the day: the event itself (all-day or timed) + every milestone. */
export async function buildEventIcs(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<{ filename: string; body: string }> {
  const { event, milestones } = await listMilestones(actor, eventId, executor);
  const location = [event.venueName, event.addressLine1, event.postalCode, event.city].filter(Boolean).join(", ") || null;
  const list: IcsEvent[] = [];
  if (event.eventDate) {
    list.push(
      event.startsAt
        ? { uid: `event-${event.id}@sousnosailes.fr`, summary: event.name, description: event.description, location, start: event.startsAt, end: event.endsAt ?? new Date(event.startsAt.getTime() + 4 * 3_600_000), stamp: event.updatedAt }
        : { uid: `event-${event.id}@sousnosailes.fr`, summary: event.name, description: event.description, location, allDay: true, start: event.eventDate, stamp: event.updatedAt },
    );
  }
  for (const m of milestones) {
    list.push({ uid: `milestone-${m.id}@sousnosailes.fr`, summary: m.title, description: m.description, location: m.location ?? location, start: m.startsAt, end: m.endsAt, stamp: m.updatedAt });
  }
  const body = buildIcsCalendar({ name: `${event.name} — planning`, events: list });
  const slug = event.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return { filename: `${slug || "evenement"}-planning.ics`, body };
}

export async function eventExists(eventId: string, executor: DbExecutor = db): Promise<boolean> {
  const [e] = await executor.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), isNull(events.deletedAt))).limit(1);
  return Boolean(e);
}
