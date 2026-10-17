/**
 * Conflict detection between expanded occurrences of the same owner. Only
 * "busy" kinds (service, event, unavailability) can conflict with each other;
 * availability/reminder/other entries are informational.
 */
export type ConflictCandidate = { entryId: string; kind: string; start: Date; end: Date; title: string };
export type Conflict = { a: ConflictCandidate; b: ConflictCandidate };

export const BUSY_KINDS: ReadonlySet<string> = new Set(["service", "event", "unavailability"]);

export function detectConflicts(items: readonly ConflictCandidate[]): Conflict[] {
  const busy = items.filter((i) => BUSY_KINDS.has(i.kind)).sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Conflict[] = [];
  for (let i = 0; i < busy.length; i++) {
    const a = busy[i]!;
    for (let j = i + 1; j < busy.length; j++) {
      const b = busy[j]!;
      if (b.start.getTime() >= a.end.getTime()) break;
      if (a.entryId === b.entryId) continue;
      if (a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()) out.push({ a, b });
    }
  }
  return out;
}

/** Ids of entries involved in at least one conflict (for list highlighting). */
export function conflictingEntryIds(conflicts: readonly Conflict[]): Set<string> {
  const set = new Set<string>();
  for (const c of conflicts) {
    set.add(c.a.entryId);
    set.add(c.b.entryId);
  }
  return set;
}
