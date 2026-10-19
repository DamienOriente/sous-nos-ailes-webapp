import { describe, expect, it } from "vitest";
import { computeLiveSchedule, dependantsOf, sequentialLinks, shiftedSteps, wouldCreateCycle, type LiveStep } from "@/modules/events/domain/live-day";

const t = (h: number, m = 0) => new Date(Date.UTC(2027, 5, 12, h, m));
const step = (id: string, start: Date, end: Date | null, dependsOn: string | null = null, over: Partial<LiveStep> = {}): LiveStep => ({ id, title: id, startsAt: start, endsAt: end, dependsOnMilestoneId: dependsOn, delayMinutes: 0, liveStatus: "planned", startedAt: null, completedAt: null, categorySlugs: [], ...over });

describe("live day schedule", () => {
  const base = [step("ceremonie", t(13, 30), t(14, 30)), step("vin", t(15), t(17), "ceremonie"), step("diner", t(17, 30), t(20), "vin"), step("gateau", t(21), null)];

  it("keeps the planned times when nothing is late", () => {
    const s = computeLiveSchedule(base);
    expect([...s.values()].every((x) => x.shiftMinutes === 0)).toBe(true);
  });

  it("propagates a delay only when it eats the buffer, keeping durations", () => {
    const late = base.map((x) => (x.id === "ceremonie" ? { ...x, delayMinutes: 45 } : x));
    const s = computeLiveSchedule(late);
    expect(s.get("ceremonie")?.shiftMinutes).toBe(45);
    expect(s.get("vin")?.shiftMinutes).toBe(15); // 30 min buffer absorbed
    expect(s.get("vin")?.pushedBy).toBe("ceremonie");
    expect(s.get("diner")?.shiftMinutes).toBe(0); // vin ends 17:15, dinner at 17:30
    const veryLate = base.map((x) => (x.id === "ceremonie" ? { ...x, delayMinutes: 90 } : x));
    const s2 = computeLiveSchedule(veryLate);
    expect(s2.get("diner")?.shiftMinutes).toBe(30);
    expect(s2.get("diner")?.pushedBy).toBe("ceremonie");
    expect(s2.get("gateau")?.shiftMinutes).toBe(0); // independent
    expect(shiftedSteps(computeLiveSchedule(base), s2)).toEqual(["ceremonie", "vin", "diner"]);
  });

  it("uses real start and finish times once known", () => {
    const live = base.map((x) => (x.id === "vin" ? { ...x, startedAt: t(15, 10), completedAt: t(17, 50), liveStatus: "done" as const } : x));
    const s = computeLiveSchedule(live);
    expect(s.get("vin")?.shiftMinutes).toBe(10);
    expect(s.get("diner")?.expectedStart).toEqual(t(17, 50));
  });

  it("finds dependants and refuses loops", () => {
    expect(dependantsOf(base, "ceremonie")).toEqual(["vin", "diner"]);
    expect(wouldCreateCycle(base, "ceremonie", "diner")).toBe(true);
    expect(wouldCreateCycle(base, "gateau", "diner")).toBe(false);
    const loop = [step("a", t(10), t(11), "b"), step("b", t(11), t(12), "a")];
    expect(() => computeLiveSchedule(loop)).not.toThrow();
  });

  it("chains only steps that follow each other, never parallel ones", () => {
    const steps = [step("install", t(8), t(12)), step("prep", t(10), t(13)), step("ceremonie", t(13, 30), t(14, 30)), step("photos", t(14), t(15)), step("vin", t(15), t(17))];
    expect(sequentialLinks(steps)).toEqual([
      ["ceremonie", "prep"],
      ["photos", "prep"], // the latest step finished before 14:00
      ["vin", "photos"],
    ]);
    const chained = steps.map((x) => ({ ...x, dependsOnMilestoneId: new Map(sequentialLinks(steps)).get(x.id) ?? null }));
    expect([...computeLiveSchedule(chained).values()].every((x) => x.shiftMinutes === 0)).toBe(true);
  });
});
