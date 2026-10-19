import { describe, expect, it } from "vitest";
import { COMPLETENESS_TOTAL, computeCompleteness, SUBMISSION_MIN_SCORE, type CompletenessInput } from "@/modules/professionals/domain/completeness";

const empty: CompletenessInput = {
  displayName: null,
  tagline: null,
  description: null,
  city: null,
  postalCode: null,
  priceFromCents: null,
  languages: [],
  eventTypes: [],
  yearsExperience: null,
  publicEmail: null,
  publicPhone: null,
  website: null,
  tradeDetails: {},
  servicesCount: 0,
  availabilityCount: 0,
  verifiedCount: 0,
};

const full: CompletenessInput = {
  displayName: "Marie Delcourt",
  tagline: "Des enfants heureux, des parents sereins.",
  description: "x".repeat(220),
  city: "Toulouse",
  postalCode: "31000",
  priceFromCents: 3500,
  languages: ["fr"],
  eventTypes: ["wedding"],
  yearsExperience: 9,
  publicEmail: "m@example.test",
  publicPhone: null,
  website: "https://example.test",
  tradeDetails: { experienceYears: 9, ageRanges: ["1-3"], services: ["supervision"] },
  servicesCount: 2,
  availabilityCount: 3,
  verifiedCount: 1,
};

describe("computeCompleteness", () => {
  it("scores 0 with recommendations for everything when nothing is filled", () => {
    const r = computeCompleteness(empty);
    expect(r.score).toBe(0);
    expect(r.recommendations.length).toBeGreaterThan(10);
    expect(r.recommendations[0]?.weight).toBeGreaterThanOrEqual(r.recommendations[1]?.weight ?? 0);
  });

  it("scores 100 when every criterion is met and weights sum consistently", () => {
    const r = computeCompleteness(full);
    expect(r.score).toBe(100);
    expect(r.recommendations).toEqual([]);
    expect(COMPLETENESS_TOTAL).toBe(100);
  });

  it("explains missing items with actionable labels and targets", () => {
    const r = computeCompleteness({ ...full, servicesCount: 0, description: "trop court" });
    const keys = r.recommendations.map((x) => x.key);
    expect(keys).toContain("services");
    expect(keys).toContain("description");
    expect(r.recommendations.find((x) => x.key === "services")?.href).toBe("prestations");
    expect(r.score).toBe(100 - 12 - 14);
  });

  it("a minimally filled listing (name, city, trade form, description) passes the submission threshold", () => {
    const r = computeCompleteness({ ...empty, displayName: "Test", city: "Albi", postalCode: "81000", languages: ["fr"], description: "y".repeat(200), tradeDetails: { a: 1, b: ["x"] } });
    expect(r.score).toBeGreaterThanOrEqual(SUBMISSION_MIN_SCORE);
  });

  it("ignores empty trade answers", () => {
    const r = computeCompleteness({ ...empty, tradeDetails: { a: "", b: [], c: null } });
    expect(r.metKeys).not.toContain("trade_details");
  });
});
