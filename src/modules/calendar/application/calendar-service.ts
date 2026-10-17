import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, lt, or, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { calendarEntries, eventMembers, events, professionals, users } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { conflictingEntryIds, detectConflicts, type Conflict } from "@/modules/calendar/domain/conflicts";
import { expandOccurrences, parseRRule } from "@/modules/calendar/domain/rrule";
import { ENTRY_KINDS, type EntryKind } from "@/modules/calendar/domain/constants";
import { isValidTimeZone } from "./ics-import";

export { ENTRY_KINDS, ENTRY_KIND_LABELS, type EntryKind } from "@/modules/calendar/domain/constants";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));

export const entryInputSchema = z
  .object({
    title: z.string().trim().min(1, "Titre requis").max(200),
    description: optionalText(5000),
    location: optionalText(300),
    kind: z.enum(ENTRY_KINDS).default("other"),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    allDay: z.coerce.boolean().default(false),
    timezone: z.string().trim().default("Europe/Paris").refine(isValidTimeZone, "Fuseau horaire inconnu"),
    rrule: optionalText(300).refine(
      (v) => {
        if (!v) return true;
        try {
          parseRRule(v);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Règle de récurrence non prise en charge (FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, BYDAY, COUNT, UNTIL)." },
    ),
    reminderMinutesBefore: z.coerce.number().int().min(0).max(60 * 24 * 30).optional().nullable(),
    professionalId: z.uuid().optional().nullable(),
    eventId: z.uuid().optional().nullable(),
  })
  .refine((v) => v.endsAt.getTime() > v.startsAt.getTime(), { message: "La fin doit être après le début.", path: ["endsAt"] });
export type EntryInput = z.infer<typeof entryInputSchema>;

export async function getUserTimezone(userId: string, executor: DbExecutor = db): Promise<string> {
  const [u] = await executor.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.timezone && isValidTimeZone(u.timezone) ? u.timezone : "Europe/Paris";
}

/** Professional listings the actor owns (for the "mes fiches pro" filter and entry attachment). */
export async function listOwnProfessionals(actor: Actor, executor: DbExecutor = db) {
  return executor.select({ id: professionals.id, displayName: professionals.displayName }).from(professionals).where(eq(professionals.ownerUserId, actor.userId));
}

export type CalendarOccurrence = {
  id: string; // `${entryId}:${occurrenceStartIso}` — unique per occurrence
  entryId: string;
  title: string;
  kind: EntryKind;
  start: Date;
  end: Date;
  allDay: boolean;
  location: string | null;
  description: string | null;
  recurring: boolean;
  readOnly: boolean;
  eventId: string | null;
  professionalId: string | null;
  href: string | null;
  conflict: boolean;
};

export type RangeFilter = { scope?: "all" | "pro" | "events"; kind?: EntryKind | null; professionalId?: string | null };

/**
 * Occurrences for the owner in [from, to): own entries (expanded) plus
 * read-only virtual entries for events the user is a member of (link to the
 * event workspace). Conflicts are computed on busy kinds.
 */
export async function listOccurrences(actor: Actor, from: Date, to: Date, filter: RangeFilter = {}, executor: DbExecutor = db): Promise<{ occurrences: CalendarOccurrence[]; conflicts: Conflict[] }> {
  const where = [eq(calendarEntries.ownerUserId, actor.userId)];
  if (filter.scope === "pro") where.push(filter.professionalId ? eq(calendarEntries.professionalId, filter.professionalId) : isNotNull(calendarEntries.professionalId));
  if (filter.scope === "events") where.push(isNotNull(calendarEntries.eventId));
  if (filter.kind) where.push(eq(calendarEntries.kind, filter.kind));
  // Non-recurring entries must overlap the range; recurring ones are kept when they started before the range end.
  where.push(or(and(lt(calendarEntries.startsAt, to), gt(calendarEntries.endsAt, from)), and(isNotNull(calendarEntries.rrule), lt(calendarEntries.startsAt, to)))!);
  const rows = await executor.select().from(calendarEntries).where(and(...where));

  const occurrences: CalendarOccurrence[] = [];
  for (const e of rows) {
    let occ;
    try {
      occ = expandOccurrences({ dtstart: e.startsAt, dtend: e.endsAt, timezone: e.timezone, rrule: e.rrule, exdates: e.exdates, rangeStart: from, rangeEnd: to, limit: 400 });
    } catch {
      occ = [{ start: e.startsAt, end: e.endsAt }];
    }
    for (const o of occ) {
      occurrences.push({
        id: `${e.id}:${o.start.toISOString()}`,
        entryId: e.id,
        title: e.title,
        kind: e.kind,
        start: o.start,
        end: o.end,
        allDay: e.allDay,
        location: e.location,
        description: e.description,
        recurring: Boolean(e.rrule),
        readOnly: false,
        eventId: e.eventId,
        professionalId: e.professionalId,
        href: e.eventId ? `/app/evenements/${e.eventId}` : null,
        conflict: false,
      });
    }
  }

  if (filter.scope !== "pro" && !filter.kind) {
    const memberEvents = await executor
      .select({ id: events.id, name: events.name, startsAt: events.startsAt, endsAt: events.endsAt, eventDate: events.eventDate, timezone: events.timezone, venueName: events.venueName, city: events.city })
      .from(eventMembers)
      .innerJoin(events, eq(events.id, eventMembers.eventId))
      .where(and(eq(eventMembers.userId, actor.userId), eq(eventMembers.status, "active")));
    const linkedEventIds = new Set(rows.filter((r) => r.eventId).map((r) => r.eventId));
    for (const ev of memberEvents) {
      if (linkedEventIds.has(ev.id)) continue; // already represented by an explicit entry
      const start = ev.startsAt ?? (ev.eventDate ? new Date(`${ev.eventDate}T00:00:00Z`) : null);
      if (!start) continue;
      const end = ev.endsAt ?? new Date(start.getTime() + 86_400_000);
      if (!(start.getTime() < to.getTime() && end.getTime() > from.getTime())) continue;
      occurrences.push({
        id: `event:${ev.id}`,
        entryId: `event:${ev.id}`,
        title: ev.name,
        kind: "event",
        start,
        end,
        allDay: !ev.startsAt,
        location: [ev.venueName, ev.city].filter(Boolean).join(", ") || null,
        description: null,
        recurring: false,
        readOnly: true,
        eventId: ev.id,
        professionalId: null,
        href: `/app/evenements/${ev.id}`,
        conflict: false,
      });
    }
  }

  const conflicts = detectConflicts(occurrences.map((o) => ({ entryId: o.entryId, kind: o.kind, start: o.start, end: o.end, title: o.title })));
  const conflictIds = conflictingEntryIds(conflicts);
  for (const o of occurrences) o.conflict = conflictIds.has(o.entryId);
  occurrences.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { occurrences, conflicts };
}

export async function getEntry(actor: Actor, entryId: string, executor: DbExecutor = db) {
  const [row] = await executor
    .select()
    .from(calendarEntries)
    .where(and(eq(calendarEntries.id, entryId), eq(calendarEntries.ownerUserId, actor.userId)))
    .limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

export async function listEntries(actor: Actor, executor: DbExecutor = db) {
  return executor.select().from(calendarEntries).where(eq(calendarEntries.ownerUserId, actor.userId)).orderBy(calendarEntries.startsAt);
}

/** Defence in depth: services re-validate the invariants even when called outside the Zod-validated actions. */
function assertEntryInvariants(input: EntryInput): void {
  if (!(input.endsAt.getTime() > input.startsAt.getTime())) throw new ValidationError("La fin doit être après le début.");
  if (!isValidTimeZone(input.timezone)) throw new ValidationError("Fuseau horaire inconnu.");
  if (input.rrule) {
    try {
      parseRRule(input.rrule);
    } catch {
      throw new ValidationError("Règle de récurrence non prise en charge.");
    }
  }
}

async function assertAttachments(actor: Actor, input: EntryInput, executor: DbExecutor) {
  assertEntryInvariants(input);
  if (input.professionalId) {
    const [p] = await executor.select({ id: professionals.id }).from(professionals).where(and(eq(professionals.id, input.professionalId), eq(professionals.ownerUserId, actor.userId))).limit(1);
    if (!p) throw new ValidationError("Fiche professionnelle inconnue.");
  }
  if (input.eventId) {
    const [m] = await executor.select({ id: eventMembers.id }).from(eventMembers).where(and(eq(eventMembers.eventId, input.eventId), eq(eventMembers.userId, actor.userId), eq(eventMembers.status, "active"))).limit(1);
    if (!m) throw new ValidationError("Évènement inconnu.");
  }
}

export async function createEntry(actor: Actor, input: EntryInput, executor: DbExecutor = db): Promise<{ id: string }> {
  await assertAttachments(actor, input, executor);
  const [row] = await executor
    .insert(calendarEntries)
    .values({ ...input, ownerUserId: actor.userId, exdates: [], icalUid: `${randomUUID()}@sousnosailes.fr` })
    .returning({ id: calendarEntries.id });
  return { id: row!.id };
}

export async function updateEntry(actor: Actor, entryId: string, input: EntryInput, executor: DbExecutor = db): Promise<void> {
  await getEntry(actor, entryId, executor);
  await assertAttachments(actor, input, executor);
  await executor.update(calendarEntries).set({ ...input }).where(eq(calendarEntries.id, entryId));
}

export async function deleteEntry(actor: Actor, entryId: string, executor: DbExecutor = db): Promise<void> {
  await getEntry(actor, entryId, executor);
  await executor.delete(calendarEntries).where(eq(calendarEntries.id, entryId));
}

/** Removes one occurrence of a recurring entry (adds an EXDATE). */
export async function excludeOccurrence(actor: Actor, entryId: string, occurrenceStart: Date, executor: DbExecutor = db): Promise<void> {
  const entry = await getEntry(actor, entryId, executor);
  if (!entry.rrule) throw new ValidationError("Cette entrée n'est pas récurrente.");
  const iso = occurrenceStart.toISOString();
  if (entry.exdates.includes(iso)) return;
  await executor.update(calendarEntries).set({ exdates: [...entry.exdates, iso] }).where(eq(calendarEntries.id, entryId));
}

export async function listEntriesByIds(actor: Actor, ids: string[], executor: DbExecutor = db) {
  if (!ids.length) return [];
  return executor.select().from(calendarEntries).where(and(eq(calendarEntries.ownerUserId, actor.userId), inArray(calendarEntries.id, ids)));
}
