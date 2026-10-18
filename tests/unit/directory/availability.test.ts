import { describe, expect, it } from "vitest";
import { firstBusyReason, isFutureOrToday, isIsoDate } from "@/modules/directory/domain/availability";

describe("availability rules", () => {
  it("reports the most meaningful reason first", () => {
    expect(firstBusyReason([])).toBeNull();
    expect(firstBusyReason(["closed", "calendar", "booked"])).toBe("booked");
    expect(firstBusyReason(["held", "held_by_you"])).toBe("held_by_you");
  });
  it("validates dates and refuses past days (Paris time)", () => {
    expect(isIsoDate("2027-02-30")).toBe(false);
    expect(isIsoDate("2027-06-12")).toBe(true);
    expect(isIsoDate("12/06/2027")).toBe(false);
    expect(isFutureOrToday("2026-10-18", new Date("2026-10-18T22:30:00Z"))).toBe(false); // already the 19th in Paris (UTC+2)
    expect(isFutureOrToday("2026-10-19", new Date("2026-10-18T22:30:00Z"))).toBe(true);
  });
});
