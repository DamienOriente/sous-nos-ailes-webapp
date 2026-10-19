import { describe, expect, it } from "vitest";
import { BOOKING_PLANS, buildRetroplanning } from "@/modules/events/domain/retroplanning";

describe("booking retroplanning", () => {
  it("dates each booking back from the event and sorts them", () => {
    const items = buildRetroplanning("wedding", "2027-06-12", "2026-10-19", new Map([["domaine-reception", "booked"], ["traiteur", "in_progress"]]));
    expect(items[0]).toMatchObject({ categorySlug: "domaine-reception", targetDate: "2026-06-17", state: "booked" });
    expect(items.find((i) => i.categorySlug === "photographe")).toMatchObject({ targetDate: "2026-08-16", state: "late" });
    expect(items.find((i) => i.categorySlug === "traiteur")?.state).toBe("in_progress");
    expect(items.find((i) => i.categorySlug === "dj")).toMatchObject({ targetDate: "2026-11-14", state: "now" });
    expect(items.find((i) => i.categorySlug === "patissier")?.state).toBe("upcoming");
    expect(items.map((i) => i.targetDate)).toEqual([...items.map((i) => i.targetDate)].sort());
  });
  it("covers every event type with known trades", () => {
    for (const steps of Object.values(BOOKING_PLANS)) expect(steps.length).toBeGreaterThan(0);
  });
});
