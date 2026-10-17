import { describe, expect, it } from "vitest";
import {
  computeEventInstants,
  formatDateOnlyLong,
  formatEventWindow,
  getTimeZoneOffsetMinutes,
  parseDateOnly,
  toDateOnlyString,
  zonedDateTimeToUtc,
} from "@/lib/time";

describe("time helpers (Europe/Paris)", () => {
  it("knows winter and summer offsets", () => {
    expect(getTimeZoneOffsetMinutes(new Date("2027-01-15T12:00:00Z"))).toBe(60);
    expect(getTimeZoneOffsetMinutes(new Date("2027-07-15T12:00:00Z"))).toBe(120);
  });

  it("converts local date-times to UTC across DST", () => {
    expect(zonedDateTimeToUtc("2027-01-15", "18:00").toISOString()).toBe("2027-01-15T17:00:00.000Z");
    expect(zonedDateTimeToUtc("2027-07-15", "18:00").toISOString()).toBe("2027-07-15T16:00:00.000Z");
  });

  it("resolves the spring-forward gap to a valid instant", () => {
    // 2027-03-28 02:30 does not exist in Paris (clocks jump 02:00 → 03:00)
    const instant = zonedDateTimeToUtc("2027-03-28", "02:30");
    expect(instant.toISOString()).toBe("2027-03-28T01:30:00.000Z");
  });

  it("resolves the fall-back ambiguity to the first occurrence", () => {
    // 2027-10-31 02:30 happens twice; first at UTC+2
    const instant = zonedDateTimeToUtc("2027-10-31", "02:30");
    expect(instant.toISOString()).toBe("2027-10-31T00:30:00.000Z");
  });

  it("handles an event spanning a DST change night", () => {
    const instants = computeEventInstants({ date: "2027-10-30", startTime: "20:00", endTime: "03:00" });
    expect(instants.crossesMidnight).toBe(true);
    // 20:00 CEST = 18:00Z ; 03:00 CET next day = 02:00Z → 8 hours wall-clock, 8h elapsed
    expect(instants.startsAt.toISOString()).toBe("2027-10-30T18:00:00.000Z");
    expect(instants.endsAt.toISOString()).toBe("2027-10-31T02:00:00.000Z");
  });

  it("round-trips date-only values", () => {
    const date = parseDateOnly("2027-06-12");
    expect(toDateOnlyString(date)).toBe("2027-06-12");
    expect(formatDateOnlyLong(date)).toBe("samedi 12 juin 2027");
    expect(() => parseDateOnly("2027-02-30")).toThrow();
  });

  it("formats an event window with next-day marker", () => {
    const instants = computeEventInstants({ date: "2027-06-12", startTime: "18:00", endTime: "01:30" });
    const text = formatEventWindow({ date: "2027-06-12", startsAt: instants.startsAt, endsAt: instants.endsAt });
    expect(text).toContain("samedi 12 juin 2027");
    expect(text).toContain("18:00");
    expect(text).toContain("01:30");
    expect(text).toContain("le lendemain");
  });
});
