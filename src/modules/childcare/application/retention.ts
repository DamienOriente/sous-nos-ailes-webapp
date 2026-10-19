import { and, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { childAuthorizedPersons, childEmergencyContacts, childSensitiveInformation, eventChildren, events } from "@/db/schema";
import { ANONYMIZED_PLACEHOLDER } from "@/modules/childcare/domain/rules";

/**
 * Retention: `delayDays` after an event's date (or end), children rows lose
 * their identifying data (names, guardian, contacts, authorised persons),
 * encrypted health data is deleted, and `anonymizedAt` is stamped. Attendance
 * and handover history stay (they reference the now-anonymous child id).
 * Called by the compliance module's runRetentionPolicies().
 */
/** `onlyEventIds` restricts the sweep (tests and targeted admin runs); production runs sweep everything. */
export async function anonymizeChildrenForEndedEvents(delayDays: number, executor: DbExecutor = db, now = new Date(), onlyEventIds?: string[]): Promise<number> {
  if (onlyEventIds && onlyEventIds.length === 0) return 0;
  const cutoff = new Date(now.getTime() - delayDays * 86_400_000);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const ended = await executor
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        onlyEventIds ? inArray(events.id, onlyEventIds) : undefined,
        or(lt(events.endsAt, cutoff), and(isNull(events.endsAt), lt(events.eventDate, cutoffDate)), and(inArray(events.status, ["completed", "archived", "cancelled"]), lt(events.updatedAt, cutoff))),
      ),
    );
  if (!ended.length) return 0;
  const eventIds = ended.map((e) => e.id);
  const targets = await executor
    .select({ id: eventChildren.id })
    .from(eventChildren)
    .where(and(inArray(eventChildren.eventId, eventIds), isNull(eventChildren.anonymizedAt)));
  if (!targets.length) return 0;
  const ids = targets.map((t) => t.id);
  await executor.delete(childSensitiveInformation).where(inArray(childSensitiveInformation.childId, ids));
  await executor.delete(childEmergencyContacts).where(inArray(childEmergencyContacts.childId, ids));
  await executor.delete(childAuthorizedPersons).where(inArray(childAuthorizedPersons.childId, ids));
  await executor
    .update(eventChildren)
    .set({
      firstName: ANONYMIZED_PLACEHOLDER,
      lastName: "",
      guardianName: ANONYMIZED_PLACEHOLDER,
      guardianPhone: ANONYMIZED_PLACEHOLDER,
      guardianEmail: null,
      careInstructions: null,
      guestId: null,
      anonymizedAt: sql`now()`,
    })
    .where(inArray(eventChildren.id, ids));
  return ids.length;
}
