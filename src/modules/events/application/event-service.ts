import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import {
  calendarEntries,
  channelMembers,
  checklistTemplates,
  eventBudgetLines,
  eventChannels,
  eventMembers,
  eventProfessionals,
  eventTasks,
  events,
  files,
  professionalCategories,
  professionals,
  userProfiles,
} from "@/db/schema";
import { ConflictError, NotFoundError, PaymentRequiredError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getEventAccess, requireEventMember, requireEventPermission, type EventAccess } from "@/modules/authorization";
import { getEffectivePlan, planFeatureLimit } from "@/modules/billing/application/entitlements";
import { recordAudit } from "@/modules/events/application/audit";
import { buildChecklist } from "@/modules/events/domain/checklist";
import { defaultCoverPhotoId, isCatalogPhotoId } from "@/modules/events/domain/cover";
import { canTransitionEventStatus, type EventStatus } from "@/modules/events/domain/event-status";
import { EVENT_TYPES, type EventType } from "@/modules/events/domain/event-types";
import { departmentFromPostalCode } from "@/modules/events/domain/event-naming";

export { departmentFromPostalCode, suggestedEventName } from "@/modules/events/domain/event-naming";

// ── Schemas ─────────────────────────────────────────────────────────────────
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ).");
const timeHm = z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide (HH:MM).");

export const createEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  name: z.string().trim().min(2, "Donnez un nom à votre évènement.").max(120),
  eventDate: isoDate.nullable(),
  dateIsTentative: z.boolean().default(false),
  startTime: timeHm.nullable().optional(),
  endTime: timeHm.nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Code postal invalide.")
    .nullable()
    .optional(),
  venueName: z.string().trim().max(160).nullable().optional(),
  addressLine1: z.string().trim().max(200).nullable().optional(),
  expectedGuests: z.number().int().min(0).max(100_000).nullable().optional(),
  expectedChildren: z.number().int().min(0).max(100_000).nullable().optional(),
  budgetCents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  wantedCategorySlugs: z.array(z.string().trim().min(1)).max(24).default([]),
  preferences: z.string().trim().max(2000).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  timezone: z.string().trim().min(1).max(64).default("Europe/Paris"),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = createEventSchema.omit({ wantedCategorySlugs: true });
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

/** Combine a local date + "HH:MM" in a timezone into a UTC Date (DST safe, no library). */
export function zonedDateTimeToUtc(isoDate: string, hm: string, timeZone: string): Date {
  const [h = 0, m = 0] = hm.split(":").map(Number);
  const guess = new Date(Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10)), h, m));
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
  const asLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offset = asLocal - guess.getTime();
  return new Date(guess.getTime() - offset);
}

// ── Create ──────────────────────────────────────────────────────────────────
export type CreatedEvent = { id: string; name: string; wantedCategorySlugs: string[] };

/**
 * Creates the whole workspace in one transaction: event, owner membership,
 * checklist from templates, general channel, one budget line and one empty
 * provider slot per wanted category, calendar entry of the day, onboarding flag.
 */
export async function createEvent(actor: Actor, raw: unknown, executor: DbExecutor = db): Promise<CreatedEvent> {
  const parsed = createEventSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Formulaire incomplet ou invalide.", { issues: parsed.error.issues });
  const input = parsed.data;
  if (input.startTime && input.endTime && input.eventDate && input.endTime < input.startTime) {
    throw new ValidationError("L'heure de fin doit être après l'heure de début.");
  }

  // Plan limit (free plan: 3 live events).
  const plan = await getEffectivePlan(actor.userId, "organizer", null, executor);
  const limit = planFeatureLimit(plan, "events.create");
  if (limit !== null) {
    const [r] = await executor
      .select({ n: count() })
      .from(events)
      .where(and(eq(events.ownerUserId, actor.userId), isNull(events.deletedAt), inArray(events.status, ["planning", "confirmed", "in_progress"])));
    if ((r?.n ?? 0) >= limit) throw new PaymentRequiredError(`Votre offre permet ${limit} évènements actifs. Passez à Organisateur Plus pour en créer davantage.`);
  }

  const categories = input.wantedCategorySlugs.length
    ? await executor.select({ id: professionalCategories.id, slug: professionalCategories.slug, name: professionalCategories.name }).from(professionalCategories).where(inArray(professionalCategories.slug, input.wantedCategorySlugs))
    : [];
  const templates = await executor.select().from(checklistTemplates).where(and(eq(checklistTemplates.eventType, input.type), eq(checklistTemplates.isActive, true)));

  const startsAt = input.eventDate && input.startTime ? zonedDateTimeToUtc(input.eventDate, input.startTime, input.timezone) : null;
  const endsAt = input.eventDate && input.endTime ? zonedDateTimeToUtc(input.eventDate, input.endTime, input.timezone) : null;

  const run = async (tx: DbExecutor): Promise<CreatedEvent> => {
    const [event] = await tx
      .insert(events)
      .values({
        ownerUserId: actor.userId,
        name: input.name,
        type: input.type,
        description: input.description ?? null,
        eventDate: input.eventDate,
        dateIsTentative: input.eventDate ? input.dateIsTentative : true,
        startsAt,
        endsAt,
        timezone: input.timezone,
        venueName: input.venueName ?? null,
        addressLine1: input.addressLine1 ?? null,
        postalCode: input.postalCode ?? null,
        city: input.city ?? null,
        department: departmentFromPostalCode(input.postalCode),
        expectedGuests: input.expectedGuests ?? null,
        expectedChildren: input.expectedChildren ?? null,
        budgetCents: input.budgetCents ?? null,
        preferences: input.preferences ?? null,
        // Ambience picture picked from the catalogue of the event type; the organiser can change it in the settings.
        coverPhotoId: defaultCoverPhotoId(input.type, `${actor.userId}:${input.name}`),
        isDemo: actor.isDemo,
      })
      .returning({ id: events.id, name: events.name });
    if (!event) throw new Error("event insert failed");

    const [owner] = await tx
      .insert(eventMembers)
      .values({ eventId: event.id, userId: actor.userId, role: "owner", status: "active", joinedAt: new Date() })
      .returning({ id: eventMembers.id });
    if (!owner) throw new Error("owner insert failed");

    const tasks = buildChecklist(templates, input.eventDate);
    if (tasks.length) {
      await tx.insert(eventTasks).values(tasks.map((t) => ({ eventId: event.id, title: t.title, description: t.description, section: t.section, dueDate: t.dueDate, sortOrder: t.sortOrder, visibility: t.visibility, createdByUserId: actor.userId })));
    }

    const [general] = await tx
      .insert(eventChannels)
      .values({ eventId: event.id, kind: "general", name: "Général", description: "Canal ouvert à toute l'équipe de l'évènement.", isOpenToAllMembers: true, createdByUserId: actor.userId })
      .returning({ id: eventChannels.id });
    if (general) await tx.insert(channelMembers).values({ channelId: general.id, memberId: owner.id, lastReadAt: new Date() });

    if (categories.length) {
      await tx.insert(eventBudgetLines).values(categories.map((c, i) => ({ eventId: event.id, category: c.name, label: c.name, plannedCents: 0, sortOrder: i })));
      await tx.insert(eventProfessionals).values(categories.map((c) => ({ eventId: event.id, categoryId: c.id, status: "shortlisted" as const })));
    }

    if (input.eventDate) {
      const dayStart = zonedDateTimeToUtc(input.eventDate, "00:00", input.timezone);
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);
      await tx
        .insert(calendarEntries)
        .values({
          ownerUserId: actor.userId,
          eventId: event.id,
          kind: "event",
          title: input.name,
          location: [input.venueName, input.city].filter(Boolean).join(", ") || null,
          startsAt: startsAt ?? dayStart,
          endsAt: endsAt ?? (startsAt ? new Date(startsAt.getTime() + 4 * 3_600_000) : dayEnd),
          allDay: !startsAt,
          timezone: input.timezone,
          icalUid: `event-${event.id}@sousnosailes.fr`,
        })
        .onConflictDoNothing();
    }

    await tx
      .insert(userProfiles)
      .values({ userId: actor.userId, onboardingCompletedAt: new Date(), primaryIntent: "organizer" })
      .onConflictDoUpdate({ target: userProfiles.userId, set: { onboardingCompletedAt: sql`coalesce(${userProfiles.onboardingCompletedAt}, now())` } });

    await recordAudit({ actorUserId: actor.userId, action: "event.created", resourceType: "event", resourceId: event.id, eventId: event.id, metadata: { type: input.type, categories: categories.map((c) => c.slug) } }, tx);
    return { id: event.id, name: event.name, wantedCategorySlugs: categories.map((c) => c.slug) };
  };

  // Services accept an executor; when it is already a transaction we reuse it.
  if ("transaction" in executor && typeof executor.transaction === "function" && executor === db) {
    return db.transaction((tx) => run(tx));
  }
  return run(executor);
}

// ── Read ────────────────────────────────────────────────────────────────────
export type EventListItem = {
  id: string;
  name: string;
  type: EventType;
  status: EventStatus;
  eventDate: string | null;
  dateIsTentative: boolean;
  city: string | null;
  venueName: string | null;
  expectedGuests: number | null;
  role: string;
  openTasks: number;
  doneTasks: number;
  totalTasks: number;
  confirmedProviders: number;
  members: number;
  /** Up to six member names for the avatar stack (alphabetical). */
  memberNames: string[];
  coverPhotoId: string | null;
  coverFileId: string | null;
};

export async function listEventsForActor(actor: Actor, executor: DbExecutor = db): Promise<EventListItem[]> {
  const rows = await executor
    .select({
      id: events.id,
      name: events.name,
      type: events.type,
      status: events.status,
      eventDate: events.eventDate,
      dateIsTentative: events.dateIsTentative,
      city: events.city,
      venueName: events.venueName,
      expectedGuests: events.expectedGuests,
      coverPhotoId: events.coverPhotoId,
      coverFileId: events.coverFileId,
      role: eventMembers.role,
      openTasks: sql<number>`(select count(*) from event_tasks t where t.event_id = ${events.id} and t.status in ('todo','in_progress'))::int`,
      doneTasks: sql<number>`(select count(*) from event_tasks t where t.event_id = ${events.id} and t.status = 'done')::int`,
      totalTasks: sql<number>`(select count(*) from event_tasks t where t.event_id = ${events.id} and t.status <> 'cancelled')::int`,
      confirmedProviders: sql<number>`(select count(*) from event_professionals p where p.event_id = ${events.id} and p.status = 'confirmed')::int`,
      members: sql<number>`(select count(*) from event_members m where m.event_id = ${events.id} and m.status = 'active')::int`,
      memberNames: sql<string[]>`coalesce((select array_agg(u.name order by (m.role = 'owner') desc, u.name) from event_members m join users u on u.id = m.user_id where m.event_id = ${events.id} and m.status = 'active'), '{}')`,
    })
    .from(eventMembers)
    .innerJoin(events, eq(events.id, eventMembers.eventId))
    .where(and(eq(eventMembers.userId, actor.userId), eq(eventMembers.status, "active"), isNull(events.deletedAt)))
    .orderBy(sql`case when ${events.status} in ('planning','confirmed','in_progress') then 0 else 1 end`, asc(events.eventDate), desc(events.createdAt));
  return rows;
}

export type EventSummary = typeof events.$inferSelect & { access: EventAccess };

/** Event header data for any member (NotFound when not a member / deleted). */
export async function getEventForMember(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<EventSummary> {
  const access = await requireEventMember(actor, eventId, executor);
  const [row] = await executor.select().from(events).where(and(eq(events.id, eventId), isNull(events.deletedAt))).limit(1);
  if (!row) throw new NotFoundError();
  return { ...row, access };
}

export async function getEventWithPermission(actor: Actor, eventId: string, permission: Parameters<typeof requireEventPermission>[2], executor: DbExecutor = db): Promise<EventSummary> {
  const access = await requireEventPermission(actor, eventId, permission, executor);
  const [row] = await executor.select().from(events).where(and(eq(events.id, eventId), isNull(events.deletedAt))).limit(1);
  if (!row) throw new NotFoundError();
  return { ...row, access };
}

// ── Update / status / delete ────────────────────────────────────────────────
export async function updateEvent(actor: Actor, eventId: string, raw: unknown, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.edit", executor);
  const parsed = updateEventSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Formulaire invalide.", { issues: parsed.error.issues });
  const input = parsed.data;
  const startsAt = input.eventDate && input.startTime ? zonedDateTimeToUtc(input.eventDate, input.startTime, input.timezone) : null;
  const endsAt = input.eventDate && input.endTime ? zonedDateTimeToUtc(input.eventDate, input.endTime, input.timezone) : null;
  if (startsAt && endsAt && endsAt < startsAt) throw new ValidationError("L'heure de fin doit être après l'heure de début.");
  await executor
    .update(events)
    .set({
      name: input.name,
      type: input.type,
      description: input.description ?? null,
      eventDate: input.eventDate,
      dateIsTentative: input.eventDate ? input.dateIsTentative : true,
      startsAt,
      endsAt,
      timezone: input.timezone,
      venueName: input.venueName ?? null,
      addressLine1: input.addressLine1 ?? null,
      postalCode: input.postalCode ?? null,
      city: input.city ?? null,
      department: departmentFromPostalCode(input.postalCode),
      expectedGuests: input.expectedGuests ?? null,
      expectedChildren: input.expectedChildren ?? null,
      budgetCents: input.budgetCents ?? null,
      preferences: input.preferences ?? null,
    })
    .where(eq(events.id, eventId));
  // Keep the owner's calendar entry in sync (title/date).
  if (input.eventDate) {
    const dayStart = zonedDateTimeToUtc(input.eventDate, "00:00", input.timezone);
    await executor
      .update(calendarEntries)
      .set({ title: input.name, startsAt: startsAt ?? dayStart, endsAt: endsAt ?? (startsAt ? new Date(startsAt.getTime() + 4 * 3_600_000) : new Date(dayStart.getTime() + 86_400_000)), allDay: !startsAt, timezone: input.timezone, location: [input.venueName, input.city].filter(Boolean).join(", ") || null })
      .where(and(eq(calendarEntries.eventId, eventId), eq(calendarEntries.kind, "event")));
  }
}

export async function changeEventStatus(actor: Actor, eventId: string, to: EventStatus, reason?: string | null, executor: DbExecutor = db): Promise<void> {
  const ev = await getEventWithPermission(actor, eventId, "event.edit", executor);
  if (to === "archived" && ev.access.role !== "owner" && !ev.access.permissions.has("event.delete")) throw new NotFoundError();
  if (!canTransitionEventStatus(ev.status, to)) throw new ConflictError(`Impossible de passer de « ${ev.status} » à « ${to} ».`);
  await executor.update(events).set({ status: to }).where(eq(events.id, eventId));
  await recordAudit({ actorUserId: actor.userId, action: "event.status_changed", resourceType: "event", resourceId: eventId, eventId, metadata: { from: ev.status, to }, reason: reason ?? null }, executor);
}

export const coverSchema = z
  .object({
    /** Catalogue photo id (modules/media/demo-photos). */
    coverPhotoId: z.string().trim().min(1).max(64).nullable().optional(),
    /** Uploaded file id (scope event, purpose cover). */
    coverFileId: z.uuid().nullable().optional(),
  })
  .refine((v) => v.coverPhotoId !== undefined || v.coverFileId !== undefined, "Choisissez une photo.");

/**
 * Changes the ambience picture: either a catalogue photo (clears the uploaded
 * file) or an uploaded file that must belong to this event with purpose cover.
 */
export async function updateEventCover(actor: Actor, eventId: string, raw: unknown, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.edit", executor);
  const parsed = coverSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Photo invalide.", { issues: parsed.error.issues });
  const { coverPhotoId, coverFileId } = parsed.data;
  if (coverFileId) {
    const [f] = await executor
      .select({ id: files.id })
      .from(files)
      .where(and(eq(files.id, coverFileId), eq(files.scope, "event"), eq(files.scopeId, eventId), eq(files.purpose, "cover"), inArray(files.status, ["quarantined", "scanning", "clean"])))
      .limit(1);
    if (!f) throw new ValidationError("Photo introuvable ou refusée.");
    await executor.update(events).set({ coverFileId }).where(eq(events.id, eventId));
    return;
  }
  if (coverPhotoId && !isCatalogPhotoId(coverPhotoId)) throw new ValidationError("Photo inconnue du catalogue.");
  await executor.update(events).set({ coverPhotoId: coverPhotoId ?? null, coverFileId: null }).where(eq(events.id, eventId));
}

/** Soft delete. Owner only, name must be typed exactly. */
export async function deleteEvent(actor: Actor, eventId: string, confirmName: string, executor: DbExecutor = db): Promise<void> {
  const ev = await getEventWithPermission(actor, eventId, "event.delete", executor);
  if (ev.ownerUserId !== actor.userId) throw new NotFoundError();
  if (confirmName.trim() !== ev.name) throw new ValidationError("Le nom saisi ne correspond pas à celui de l'évènement.");
  await executor.update(events).set({ deletedAt: new Date() }).where(eq(events.id, eventId));
  await recordAudit({ actorUserId: actor.userId, action: "event.deleted", resourceType: "event", resourceId: eventId, eventId, metadata: { name: ev.name } }, executor);
}

// ── Suggestions after onboarding ────────────────────────────────────────────
export type SuggestedProfessional = { id: string; slug: string; displayName: string; tagline: string | null; city: string | null; categoryName: string; categorySlug: string };

/** Up to 3 published professionals per wanted category, same department first. Minimal cards, no dependency on the directory module. */
export async function suggestProfessionals(categorySlugs: readonly string[], department: string | null, executor: DbExecutor = db): Promise<SuggestedProfessional[]> {
  if (!categorySlugs.length) return [];
  const rows = await executor
    .select({
      id: professionals.id,
      slug: professionals.slug,
      displayName: professionals.displayName,
      tagline: professionals.tagline,
      city: professionals.city,
      department: professionals.department,
      categoryName: professionalCategories.name,
      categorySlug: professionalCategories.slug,
    })
    .from(professionals)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(and(eq(professionals.status, "published"), isNull(professionals.deletedAt), inArray(professionalCategories.slug, [...categorySlugs])))
    .orderBy(desc(professionals.verificationLevel), desc(professionals.averageRating))
    .limit(60);
  const perCategory = new Map<string, SuggestedProfessional[]>();
  const sorted = [...rows].sort((a, b) => Number(b.department === department) - Number(a.department === department));
  for (const r of sorted) {
    const list = perCategory.get(r.categorySlug) ?? [];
    if (list.length < 3) list.push(r);
    perCategory.set(r.categorySlug, list);
  }
  return [...perCategory.values()].flat();
}

/** Categories still wanted (slot without professional) for the dashboard panel. */
export async function wantedCategories(eventId: string, executor: DbExecutor = db): Promise<Array<{ slug: string; name: string; filled: boolean }>> {
  const rows = await executor
    .select({ slug: professionalCategories.slug, name: professionalCategories.name, professionalId: eventProfessionals.professionalId, externalName: eventProfessionals.externalName, status: eventProfessionals.status })
    .from(eventProfessionals)
    .innerJoin(professionalCategories, eq(professionalCategories.id, eventProfessionals.categoryId))
    .where(eq(eventProfessionals.eventId, eventId));
  const map = new Map<string, { slug: string; name: string; filled: boolean }>();
  for (const r of rows) {
    const filled = Boolean(r.professionalId || r.externalName) && r.status !== "cancelled" && r.status !== "declined";
    const cur = map.get(r.slug);
    map.set(r.slug, { slug: r.slug, name: r.name, filled: (cur?.filled ?? false) || filled });
  }
  return [...map.values()];
}

export { getEventAccess };
