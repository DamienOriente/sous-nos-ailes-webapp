import { db, type DbExecutor } from "@/db/client";
import type { Actor } from "@/lib/session";
import { generateIcs } from "@/modules/calendar/domain/ics";
import { listEntries } from "./calendar-service";

/**
 * Personal ICS export: every entry owned by the actor (authenticated route).
 * Health data is never part of calendar entries, so the file only contains
 * titles, places, times and descriptions typed by the owner.
 */
export async function exportUserCalendarIcs(actor: Actor, executor: DbExecutor = db): Promise<string> {
  const entries = await listEntries(actor, executor);
  return generateIcs(
    entries.map((e) => ({
      uid: e.icalUid,
      title: e.title,
      description: e.description,
      location: e.location,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
      timezone: e.timezone,
      rrule: e.rrule,
      exdates: e.exdates,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    { calendarName: `Sous Nos Ailes, ${actor.name}` },
  );
}
