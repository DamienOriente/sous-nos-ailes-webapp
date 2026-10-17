import { and, eq, isNotNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { calendarEntries, calendarReminderDispatches } from "@/db/schema";
import { expandOccurrences } from "@/modules/calendar/domain/rrule";
import { notify } from "@/modules/notifications/application/notification-service";

/** Reminders older than this are considered missed and are not sent (avoids a burst after downtime). */
const MAX_LATE_MS = 6 * 3_600_000;

/**
 * Creates one `deadline` notification per (entry, occurrence) whose reminder
 * time has passed and has not been dispatched yet. Recurring entries are
 * expanded in their time zone. Called by the worker every few minutes.
 */
export async function dispatchDueReminders(executor: DbExecutor = db, now = new Date()): Promise<number> {
  const entries = await executor.select().from(calendarEntries).where(isNotNull(calendarEntries.reminderMinutesBefore));
  let dispatched = 0;
  for (const entry of entries) {
    const reminderMs = (entry.reminderMinutesBefore ?? 0) * 60_000;
    // Occurrences whose reminder is due now: start ∈ (now - MAX_LATE, now + reminder]
    const rangeStart = new Date(now.getTime() - MAX_LATE_MS);
    const rangeEnd = new Date(now.getTime() + reminderMs + 60_000);
    let occurrences;
    try {
      occurrences = expandOccurrences({ dtstart: entry.startsAt, dtend: entry.endsAt, timezone: entry.timezone, rrule: entry.rrule, exdates: entry.exdates, rangeStart, rangeEnd, limit: 50 });
    } catch {
      continue; // malformed rule: skip silently, the UI validates rules on save
    }
    for (const occ of occurrences) {
      if (occ.start.getTime() - reminderMs > now.getTime()) continue; // not yet due
      if (occ.start.getTime() < now.getTime() - MAX_LATE_MS) continue; // too old
      const already = await executor
        .select({ id: calendarReminderDispatches.id })
        .from(calendarReminderDispatches)
        .where(and(eq(calendarReminderDispatches.entryId, entry.id), eq(calendarReminderDispatches.occurrenceStartsAt, occ.start)))
        .limit(1);
      if (already.length) continue;
      const inserted = await executor.insert(calendarReminderDispatches).values({ entryId: entry.id, occurrenceStartsAt: occ.start }).onConflictDoNothing().returning({ id: calendarReminderDispatches.id });
      if (!inserted.length) continue;
      const when = new Intl.DateTimeFormat("fr-FR", { timeZone: entry.timezone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(occ.start);
      await notify(
        {
          userId: entry.ownerUserId,
          type: "deadline",
          title: `Rappel : ${entry.title}`,
          body: `${when}${entry.location ? ` — ${entry.location}` : ""}`,
          href: `/app/calendrier?date=${occ.start.toISOString().slice(0, 10)}&view=day`,
          eventId: entry.eventId ?? undefined,
          dedupeKey: `calendar-reminder:${entry.id}:${occ.start.toISOString()}`,
        },
        executor,
      );
      dispatched++;
    }
  }
  return dispatched;
}
