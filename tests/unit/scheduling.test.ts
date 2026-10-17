import { describe, expect, it } from "vitest";
import { availabilityStatusFor, computeNightMinutes, findConflicts, intervalsOverlap, withBuffer } from "@/domain/scheduling";
import { computeEventInstants, getTimeZoneOffsetMinutes } from "@/lib/time";

const d = (iso: string) => new Date(iso);

describe("scheduling conflicts", () => {
  it("detects direct overlaps and ignores adjacent intervals", () => {
    const a = { startsAt: d("2027-06-12T16:00:00Z"), endsAt: d("2027-06-12T22:00:00Z") };
    expect(intervalsOverlap(a, { startsAt: d("2027-06-12T21:00:00Z"), endsAt: d("2027-06-13T01:00:00Z") })).toBe(true);
    expect(intervalsOverlap(a, { startsAt: d("2027-06-12T22:00:00Z"), endsAt: d("2027-06-13T01:00:00Z") })).toBe(false);
  });

  it("applies the travel buffer on both sides", () => {
    const candidate = { startsAt: d("2027-06-12T16:00:00Z"), endsAt: d("2027-06-12T22:00:00Z") };
    const buffered = withBuffer(candidate, 45);
    expect(buffered.startsAt.toISOString()).toBe("2027-06-12T15:15:00.000Z");
    const conflicts = findConflicts({
      candidate,
      bufferMinutes: 45,
      assignments: [
        { id: "a1", eventId: "e1", eventReference: "LPI-2027-0001", startsAt: d("2027-06-12T22:30:00Z"), endsAt: d("2027-06-13T02:00:00Z") },
        { id: "a2", eventId: "e2", eventReference: "LPI-2027-0002", startsAt: d("2027-06-12T23:00:00Z"), endsAt: d("2027-06-13T02:00:00Z") },
      ],
      unavailabilities: [],
    });
    expect(conflicts.map((c) => c.id)).toEqual(["a1"]);
    expect(conflicts[0].explanation).toMatch(/marge de déplacement/);
  });

  it("handles an event crossing midnight", () => {
    const instants = computeEventInstants({ date: "2027-06-12", startTime: "18:00", endTime: "01:30" });
    expect(instants.crossesMidnight).toBe(true);
    expect(instants.endDateOnly).toBe("2027-06-13");
    // Paris is UTC+2 in June
    expect(instants.startsAt.toISOString()).toBe("2027-06-12T16:00:00.000Z");
    expect(instants.endsAt.toISOString()).toBe("2027-06-12T23:30:00.000Z");
    const conflicts = findConflicts({
      candidate: instants,
      bufferMinutes: 0,
      assignments: [],
      unavailabilities: [{ id: "u1", startsAt: d("2027-06-12T23:00:00Z"), endsAt: d("2027-06-13T08:00:00Z"), note: "nuit" }],
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("UNAVAILABILITY");
  });

  it("reports availability coverage", () => {
    const candidate = { startsAt: d("2027-06-12T16:00:00Z"), endsAt: d("2027-06-12T22:00:00Z") };
    expect(availabilityStatusFor(candidate, [{ id: "w", startsAt: d("2027-06-12T08:00:00Z"), endsAt: d("2027-06-13T00:00:00Z") }])).toBe("DECLARED_AVAILABLE");
    expect(availabilityStatusFor(candidate, [{ id: "w", startsAt: d("2027-06-12T18:00:00Z"), endsAt: d("2027-06-13T00:00:00Z") }])).toBe("PARTIAL");
    expect(availabilityStatusFor(candidate, [])).toBe("NOT_DECLARED");
  });

  it("counts night minutes in Europe/Paris", () => {
    const instants = computeEventInstants({ date: "2027-06-12", startTime: "20:00", endTime: "01:00" });
    const localHour = (instant: Date) => {
      const offset = getTimeZoneOffsetMinutes(instant);
      return new Date(instant.getTime() + offset * 60_000).getUTCHours();
    };
    // 22:00 → 01:00 = 180 minutes of night
    expect(computeNightMinutes(instants, 22, localHour)).toBe(180);
  });
});
