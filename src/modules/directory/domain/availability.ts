/**
 * Real availability of a professional on a given day (2026-10-18). A professional is free when
 * nothing below applies; the first reason found is shown to the organiser, never the details
 * (a synced personal calendar only says "busy").
 */
export type BusyReason = "closed" | "unavailable" | "booked" | "calendar" | "held" | "held_by_you";

export const BUSY_REASON_LABELS: Record<BusyReason, string> = {
  closed: "Ne travaille pas ce jour-là",
  unavailable: "Indisponible ce jour-là",
  booked: "Déjà réservé ce jour-là",
  calendar: "Occupé ce jour-là",
  held: "Option posée par un autre organisateur",
  held_by_you: "Vous avez posé une option",
};

/** Order of precedence when several reasons apply. */
export const BUSY_PRECEDENCE: readonly BusyReason[] = ["held_by_you", "booked", "held", "unavailable", "calendar", "closed"];

export function firstBusyReason(reasons: Iterable<BusyReason>): BusyReason | null {
  const set = new Set(reasons);
  return BUSY_PRECEDENCE.find((r) => set.has(r)) ?? null;
}

/** Hold duration (48 hours) and how many active options one organiser may keep at once. */
export const HOLD_HOURS = 48;
export const MAX_ACTIVE_HOLDS_PER_USER = 5;

/** A real calendar day written AAAA-MM-JJ (rejects 2027-02-30). */
export function isIsoDate(v: string | null | undefined): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** A hold or a search only makes sense for a day that has not passed (Paris time). */
export function isFutureOrToday(date: string, now: Date = new Date()): boolean {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  return date >= today;
}
