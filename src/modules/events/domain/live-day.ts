/**
 * Live day-of timeline (2026-10-19). Each step keeps its planned time; a reported delay or a
 * late finish shifts it, and every step that depends on it (transitively) starts no earlier
 * than its predecessor's expected end. Durations are preserved. Pure: no IO.
 */
export type LiveStep = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  dependsOnMilestoneId: string | null;
  delayMinutes: number;
  liveStatus: "planned" | "in_progress" | "done";
  startedAt: Date | null;
  completedAt: Date | null;
  categorySlugs: string[];
};

export type LiveTiming = {
  expectedStart: Date;
  expectedEnd: Date | null;
  /** Minutes between planned and expected start (0 = on time). */
  shiftMinutes: number;
  /** Step whose delay pushes this one, when the shift comes from a predecessor. */
  pushedBy: string | null;
};

const MIN = 60_000;

export function computeLiveSchedule(steps: readonly LiveStep[]): Map<string, LiveTiming> {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const out = new Map<string, LiveTiming>();
  const visiting = new Set<string>();

  const resolve = (s: LiveStep): LiveTiming => {
    const done = out.get(s.id);
    if (done) return done;
    const duration = s.endsAt ? s.endsAt.getTime() - s.startsAt.getTime() : null;
    let start = s.startsAt.getTime() + s.delayMinutes * MIN;
    let pushedBy: string | null = null;
    const pred = s.dependsOnMilestoneId ? byId.get(s.dependsOnMilestoneId) : undefined;
    if (pred && !visiting.has(pred.id)) {
      visiting.add(s.id);
      const p = resolve(pred);
      visiting.delete(s.id);
      const predEnd = (p.expectedEnd ?? p.expectedStart).getTime();
      if (predEnd > start) {
        start = predEnd;
        pushedBy = p.pushedBy ?? pred.id;
      }
    }
    if (s.startedAt) start = s.startedAt.getTime();
    let end = duration === null ? null : start + duration;
    if (s.completedAt) end = s.completedAt.getTime();
    const timing: LiveTiming = { expectedStart: new Date(start), expectedEnd: end === null ? null : new Date(end), shiftMinutes: Math.round((start - s.startsAt.getTime()) / MIN), pushedBy: s.startedAt ? null : pushedBy };
    out.set(s.id, timing);
    return timing;
  };
  for (const s of steps) resolve(s);
  return out;
}

/** Steps that (transitively) depend on `id`. */
export function dependantsOf(steps: readonly LiveStep[], id: string): string[] {
  const out: string[] = [];
  const queue = [id];
  const seen = new Set([id]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const s of steps) {
      if (s.dependsOnMilestoneId === current && !seen.has(s.id)) {
        seen.add(s.id);
        out.push(s.id);
        queue.push(s.id);
      }
    }
  }
  return out;
}

/** Linking `id` after `dependsOn` must not create a loop. */
export function wouldCreateCycle(steps: readonly LiveStep[], id: string, dependsOn: string): boolean {
  return id === dependsOn || dependantsOf(steps, id).includes(dependsOn);
}

/** Steps whose expected start moved between two schedules (for notifications). */
export function shiftedSteps(before: Map<string, LiveTiming>, after: Map<string, LiveTiming>): string[] {
  const out: string[] = [];
  for (const [id, t] of after) {
    const b = before.get(id);
    if (b && b.expectedStart.getTime() !== t.expectedStart.getTime()) out.push(id);
  }
  return out;
}

/**
 * Automatic chaining: each step waits for the latest earlier step that ends before (or when) it
 * starts. Steps running in parallel (overlapping) stay independent, so chaining never shifts
 * anything on its own. Returns [stepId, dependsOnId] pairs.
 */
export function sequentialLinks(steps: readonly Pick<LiveStep, "id" | "startsAt" | "endsAt">[]): [string, string][] {
  const sorted = [...steps].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const links: [string, string][] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i]!;
    let best: (typeof sorted)[number] | null = null;
    for (let j = 0; j < i; j += 1) {
      const prev = sorted[j]!;
      const prevEnd = (prev.endsAt ?? prev.startsAt).getTime();
      if (prevEnd <= cur.startsAt.getTime() && (!best || prevEnd >= (best.endsAt ?? best.startsAt).getTime())) best = prev;
    }
    if (best) links.push([cur.id, best.id]);
  }
  return links;
}
