// Overlap detection with a configurable travel buffer. Works on UTC instants,
// so events crossing midnight or DST changes need no special casing.

export type Interval = { startsAt: Date; endsAt: Date };

export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

export function withBuffer(interval: Interval, bufferMinutes: number): Interval {
  const ms = Math.max(0, bufferMinutes) * 60_000;
  return { startsAt: new Date(interval.startsAt.getTime() - ms), endsAt: new Date(interval.endsAt.getTime() + ms) };
}

export type ExistingAssignment = Interval & { id: string; eventId: string; eventReference: string };
export type Unavailability = Interval & { id: string; note?: string | null };
export type AvailabilityWindow = Interval & { id: string };

export type Conflict =
  | { kind: "ASSIGNMENT"; id: string; eventId: string; eventReference: string; explanation: string }
  | { kind: "UNAVAILABILITY"; id: string; explanation: string };

export function findConflicts(input: {
  candidate: Interval;
  bufferMinutes: number;
  assignments: ExistingAssignment[];
  unavailabilities: Unavailability[];
}): Conflict[] {
  const buffered = withBuffer(input.candidate, input.bufferMinutes);
  const conflicts: Conflict[] = [];
  for (const assignment of input.assignments) {
    if (intervalsOverlap(buffered, assignment)) {
      const direct = intervalsOverlap(input.candidate, assignment);
      conflicts.push({
        kind: "ASSIGNMENT",
        id: assignment.id,
        eventId: assignment.eventId,
        eventReference: assignment.eventReference,
        explanation: direct
          ? `Déjà affecté·e sur ${assignment.eventReference} aux mêmes horaires.`
          : `Affectation sur ${assignment.eventReference} trop proche (marge de déplacement de ${input.bufferMinutes} min).`,
      });
    }
  }
  for (const unavailability of input.unavailabilities) {
    if (intervalsOverlap(input.candidate, unavailability)) {
      conflicts.push({
        kind: "UNAVAILABILITY",
        id: unavailability.id,
        explanation: unavailability.note
          ? `Indisponibilité déclarée : ${unavailability.note}`
          : "Indisponibilité déclarée sur ce créneau.",
      });
    }
  }
  return conflicts;
}

export type AvailabilityStatus = "DECLARED_AVAILABLE" | "NOT_DECLARED" | "PARTIAL";

/** Whether the candidate window is fully inside a declared availability window. */
export function availabilityStatusFor(candidate: Interval, windows: AvailabilityWindow[]): AvailabilityStatus {
  const covering = windows.find(
    (w) => w.startsAt.getTime() <= candidate.startsAt.getTime() && w.endsAt.getTime() >= candidate.endsAt.getTime(),
  );
  if (covering) return "DECLARED_AVAILABLE";
  const touching = windows.some((w) => intervalsOverlap(w, candidate));
  return touching ? "PARTIAL" : "NOT_DECLARED";
}

/**
 * Minutes of the interval falling in the night window [startHour, 06:00) in the
 * given zone. Sampled by quarter hours; adequate for pricing.
 */
export function computeNightMinutes(
  interval: Interval,
  nightStartHour: number,
  localHourAt: (instant: Date) => number,
): number {
  const step = 15;
  let minutes = 0;
  for (let t = interval.startsAt.getTime(); t < interval.endsAt.getTime(); t += step * 60_000) {
    const hour = localHourAt(new Date(t));
    if (hour >= nightStartHour || hour < 6) minutes += step;
  }
  return minutes;
}
