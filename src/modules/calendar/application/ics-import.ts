import ical from "node-ical";
import { and, eq, inArray } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { calendarEntries } from "@/db/schema";
import { ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { MAX_ICS_BYTES, validateParsedEvent, type ParsedIcsEvent } from "@/modules/calendar/domain/ics";
import { parseRRule } from "@/modules/calendar/domain/rrule";

export type IcsParseResult = { events: ParsedIcsEvent[]; errors: string[]; skipped: { uid: string; reason: string }[] };

type DateWithTz = Date & { tz?: string; dateOnly?: true };

/**
 * Parses an ICS text into normalised events. Strict: invalid events are
 * skipped with a reason, unparsable files return an error. Duplicate UIDs are
 * collapsed (last definition wins, like node-ical does).
 */
export function parseIcsText(text: string, fallbackTimezone = "Europe/Paris"): IcsParseResult {
  const errors: string[] = [];
  const skipped: { uid: string; reason: string }[] = [];
  if (Buffer.byteLength(text, "utf8") > MAX_ICS_BYTES) return { events: [], errors: ["Fichier trop volumineux (max 1 Mo)."], skipped };
  if (!/BEGIN:VCALENDAR/i.test(text)) return { events: [], errors: ["Ce fichier n'est pas un calendrier iCalendar (BEGIN:VCALENDAR manquant)."], skipped };
  let data: ReturnType<typeof ical.sync.parseICS>;
  try {
    data = ical.sync.parseICS(text);
  } catch (e) {
    return { events: [], errors: [`Fichier illisible : ${e instanceof Error ? e.message : "erreur de parsing"}`], skipped };
  }
  const events: ParsedIcsEvent[] = [];
  for (const [key, component] of Object.entries(data)) {
    if (!component || typeof component !== "object" || (component as { type?: string }).type !== "VEVENT") continue;
    const ev = component as Record<string, unknown> & { uid?: string; start?: DateWithTz; end?: DateWithTz; summary?: unknown; description?: unknown; location?: unknown; rrule?: { toString(): string } | null; exdate?: Record<string, DateWithTz> };
    const uid = String(ev.uid ?? key);
    const start = ev.start;
    if (!(start instanceof Date)) {
      skipped.push({ uid, reason: "DTSTART manquant" });
      continue;
    }
    const allDay = Boolean(start.dateOnly);
    const end: Date = ev.end instanceof Date ? ev.end : new Date(start.getTime() + (allDay ? 86_400_000 : 3_600_000));
    const timezone = typeof start.tz === "string" && isValidTimeZone(start.tz) ? start.tz : fallbackTimezone;
    let rrule: string | null = null;
    if (ev.rrule) {
      const raw = String(ev.rrule.toString())
        .split(/\r?\n/)
        .find((l) => /^RRULE:/i.test(l) || /FREQ=/.test(l));
      if (raw) {
        const candidate = raw.replace(/^RRULE:/i, "").replace(/;?(DTSTART|TZID)=[^;]*/g, "");
        try {
          parseRRule(candidate);
          rrule = candidate;
        } catch {
          skipped.push({ uid, reason: "Règle de récurrence non prise en charge" });
          continue;
        }
      }
    }
    const exdates = ev.exdate ? Object.values(ev.exdate).filter((d): d is DateWithTz => d instanceof Date).map((d) => d.toISOString()) : [];
    const parsed: ParsedIcsEvent = {
      uid,
      title: textValue(ev.summary) || "(sans titre)",
      description: textValue(ev.description) || null,
      location: textValue(ev.location) || null,
      startsAt: start,
      endsAt: end,
      allDay,
      timezone,
      rrule,
      exdates,
    };
    const problem = validateParsedEvent(parsed);
    if (problem) {
      skipped.push({ uid, reason: problem });
      continue;
    }
    events.push(parsed);
  }
  if (!events.length && !skipped.length) errors.push("Aucun évènement (VEVENT) trouvé dans ce fichier.");
  return { events, errors, skipped };
}

function textValue(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && "val" in v && typeof (v as { val: unknown }).val === "string") return (v as { val: string }).val.trim();
  return "";
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type ImportPreview = { toCreate: ParsedIcsEvent[]; toUpdate: ParsedIcsEvent[]; skipped: { uid: string; reason: string }[]; errors: string[] };

/** Compares parsed events with the owner's existing UIDs (dedupe by UID). */
export async function previewIcsImport(actor: Actor, text: string, executor: DbExecutor = db): Promise<ImportPreview> {
  const parsed = parseIcsText(text);
  if (parsed.errors.length) return { toCreate: [], toUpdate: [], skipped: parsed.skipped, errors: parsed.errors };
  const uids = parsed.events.map((e) => e.uid);
  const existing = uids.length
    ? await executor
        .select({ icalUid: calendarEntries.icalUid })
        .from(calendarEntries)
        .where(and(eq(calendarEntries.ownerUserId, actor.userId), inArray(calendarEntries.icalUid, uids)))
    : [];
  const existingSet = new Set(existing.map((e) => e.icalUid));
  return {
    toCreate: parsed.events.filter((e) => !existingSet.has(e.uid)),
    toUpdate: parsed.events.filter((e) => existingSet.has(e.uid)),
    skipped: parsed.skipped,
    errors: [],
  };
}

/** Imports (upsert by owner+UID). Imported entries keep their UID and have no source connection. */
export async function importIcs(actor: Actor, text: string, opts: { professionalId?: string | null } = {}, executor: DbExecutor = db): Promise<{ created: number; updated: number; skipped: number }> {
  const preview = await previewIcsImport(actor, text, executor);
  if (preview.errors.length) throw new ValidationError(preview.errors.join(" "));
  if (!preview.toCreate.length && !preview.toUpdate.length) throw new ValidationError("Aucun évènement valide à importer.");
  let created = 0;
  let updated = 0;
  for (const e of [...preview.toCreate, ...preview.toUpdate]) {
    const res = await executor
      .insert(calendarEntries)
      .values({
        ownerUserId: actor.userId,
        professionalId: opts.professionalId ?? null,
        kind: "other",
        title: e.title,
        description: e.description,
        location: e.location,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        allDay: e.allDay,
        timezone: e.timezone,
        rrule: e.rrule,
        exdates: e.exdates,
        icalUid: e.uid,
        sourceConnectionId: null,
      })
      .onConflictDoUpdate({
        target: [calendarEntries.ownerUserId, calendarEntries.icalUid],
        set: { title: e.title, description: e.description, location: e.location, startsAt: e.startsAt, endsAt: e.endsAt, allDay: e.allDay, timezone: e.timezone, rrule: e.rrule, exdates: e.exdates },
      })
      .returning({ createdAt: calendarEntries.createdAt, updatedAt: calendarEntries.updatedAt });
    const row = res[0];
    if (row && Math.abs(row.createdAt.getTime() - row.updatedAt.getTime()) < 1000) created++;
    else updated++;
  }
  return { created, updated, skipped: preview.skipped.length };
}
