import { and, eq, gt, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalHolds, professionals } from "@/db/schema";
import { firstBusyReason, type BusyReason } from "@/modules/directory/domain/availability";

/** Start/end of a calendar day in Paris, as timestamptz SQL. */
const dayStart = (date: string) => sql`((${date}::date)::timestamp at time zone 'Europe/Paris')`;
const dayEnd = (date: string) => sql`(((${date}::date + 1))::timestamp at time zone 'Europe/Paris')`;

/** Active option (not lapsed) or confirmed option on that day. */
export function activeHoldCondition(): SQL {
  return or(eq(professionalHolds.status, "confirmed"), and(eq(professionalHolds.status, "active"), gt(professionalHolds.expiresAt, sql`now()`))) as SQL;
}

/**
 * SQL condition "the professional is free on `date`" for the directory search, against the
 * outer `professionals` row. Same rules as `availabilityOn`.
 */
export function freeOnDateSql(date: string, viewerUserId: string | null): SQL {
  const weekday = sql`(extract(isodow from ${date}::date)::int - 1)`;
  const viewer = viewerUserId ?? "";
  return sql`(
    not exists (select 1 from calendar_entries ce where ce.professional_id = ${professionals.id} and ce.kind in ('unavailability', 'event', 'service') and ce.starts_at < ${dayEnd(date)} and ce.ends_at > ${dayStart(date)})
    and not exists (select 1 from calendar_entries ce where ce.owner_user_id = ${professionals.ownerUserId} and ce.source_connection_id is not null and ce.starts_at < ${dayEnd(date)} and ce.ends_at > ${dayStart(date)})
    and not exists (select 1 from event_professionals ep join events e on e.id = ep.event_id where ep.professional_id = ${professionals.id} and ep.status = 'confirmed' and e.deleted_at is null and e.status <> 'cancelled' and e.event_date = ${date}::date)
    and not exists (select 1 from professional_holds h where h.professional_id = ${professionals.id} and h.hold_date = ${date}::date and h.requester_user_id <> ${viewer} and (h.status = 'confirmed' or (h.status = 'active' and h.expires_at > now())))
    and (not exists (select 1 from professional_availability pa where pa.professional_id = ${professionals.id}) or exists (select 1 from professional_availability pa where pa.professional_id = ${professionals.id} and pa.weekday = ${weekday}))
  )`;
}

export type DayAvailability = { available: boolean; reason: BusyReason | null; holdExpiresAt: Date | null };

/** Availability of several professionals on one day, with the reason when busy. */
export async function availabilityOn(
  professionalIds: string[],
  date: string,
  viewerUserId: string | null,
  executor: DbExecutor = db,
  /** The event being planned: its own bookings do not make its providers "busy". */
  excludeEventId: string | null = null,
): Promise<Map<string, DayAvailability>> {
  const out = new Map<string, DayAvailability>();
  const ids = [...new Set(professionalIds)];
  if (!ids.length) return out;
  const idList = sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `);
  const rows = await executor.execute<{ id: string; reason: BusyReason }>(sql`
    select p.id, 'unavailable' as reason from professionals p where p.id in (${idList}) and exists (select 1 from calendar_entries ce where ce.professional_id = p.id and ce.kind = 'unavailability' and ce.starts_at < ${dayEnd(date)} and ce.ends_at > ${dayStart(date)})
    union all
    select p.id, 'booked' from professionals p where p.id in (${idList}) and (
      exists (select 1 from calendar_entries ce where ce.professional_id = p.id and ce.kind in ('event', 'service') and ce.starts_at < ${dayEnd(date)} and ce.ends_at > ${dayStart(date)} and ce.event_id is distinct from ${excludeEventId}::uuid)
      or exists (select 1 from event_professionals ep join events e on e.id = ep.event_id where ep.professional_id = p.id and ep.status = 'confirmed' and e.deleted_at is null and e.status <> 'cancelled' and e.event_date = ${date}::date and e.id <> ${excludeEventId ?? "00000000-0000-0000-0000-000000000000"}::uuid))
    union all
    select p.id, 'calendar' from professionals p where p.id in (${idList}) and exists (select 1 from calendar_entries ce where ce.owner_user_id = p.owner_user_id and ce.source_connection_id is not null and ce.starts_at < ${dayEnd(date)} and ce.ends_at > ${dayStart(date)})
    union all
    select p.id, 'closed' from professionals p where p.id in (${idList}) and exists (select 1 from professional_availability pa where pa.professional_id = p.id) and not exists (select 1 from professional_availability pa where pa.professional_id = p.id and pa.weekday = (extract(isodow from ${date}::date)::int - 1))
  `);
  const reasons = new Map<string, BusyReason[]>();
  for (const r of rows.rows) reasons.set(r.id, [...(reasons.get(r.id) ?? []), r.reason]);
  const holds = await executor
    .select({ professionalId: professionalHolds.professionalId, requesterUserId: professionalHolds.requesterUserId, expiresAt: professionalHolds.expiresAt, status: professionalHolds.status })
    .from(professionalHolds)
    .where(and(inArray(professionalHolds.professionalId, ids), eq(professionalHolds.holdDate, date), activeHoldCondition()));
  const myHold = new Map<string, Date>();
  for (const h of holds) {
    const mine = viewerUserId !== null && h.requesterUserId === viewerUserId;
    if (mine && h.status === "active") myHold.set(h.professionalId, h.expiresAt);
    reasons.set(h.professionalId, [...(reasons.get(h.professionalId) ?? []), mine ? "held_by_you" : "held"]);
  }
  for (const id of ids) {
    const reason = firstBusyReason(reasons.get(id) ?? []);
    // The viewer's own option does not make the date unavailable to them.
    out.set(id, { available: reason === null || reason === "held_by_you", reason, holdExpiresAt: myHold.get(id) ?? null });
  }
  return out;
}
