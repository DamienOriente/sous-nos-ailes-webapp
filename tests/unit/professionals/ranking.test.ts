import { describe, expect, it } from "vitest";
import { compareRanked, scoreListing, type RankingInput } from "@/modules/professionals/domain/ranking";

const base: RankingInput = {
  categoryMatch: "primary",
  distanceKm: 0,
  availableOnDate: true,
  eventTypeRequested: true,
  eventTypeMatch: true,
  childrenRequested: true,
  acceptsChildren: true,
  completenessScore: 100,
  verificationLevel: 5,
  averageRating: null,
  reviewCount: 0,
};

describe("scoreListing", () => {
  it("gives the documented maximum of 100 without reviews", () => {
    const r = scoreListing(base);
    expect(r).toMatchObject({ trade: 30, proximity: 20, availability: 15, compatibility: 10, completeness: 15, verification: 10, reviews: 0 });
    expect(r.total).toBe(100);
  });

  it("decays proximity linearly down to 0 at the decay distance", () => {
    expect(scoreListing({ ...base, distanceKm: 50, decayKm: 100 }).proximity).toBeCloseTo(10);
    expect(scoreListing({ ...base, distanceKm: 100, decayKm: 100 }).proximity).toBe(0);
    expect(scoreListing({ ...base, distanceKm: 500, decayKm: 100 }).proximity).toBe(0);
    // unknown origin → neutral half score
    expect(scoreListing({ ...base, distanceKm: null }).proximity).toBe(10);
  });

  it("secondary and text matches score less than the primary trade", () => {
    expect(scoreListing({ ...base, categoryMatch: "secondary" }).trade).toBe(20);
    expect(scoreListing({ ...base, categoryMatch: "text" }).trade).toBe(10);
    expect(scoreListing({ ...base, categoryMatch: "none" }).trade).toBe(0);
  });

  it("availability: not requested is neutral, unavailable is 0", () => {
    expect(scoreListing({ ...base, availableOnDate: null }).availability).toBe(10);
    expect(scoreListing({ ...base, availableOnDate: false }).availability).toBe(0);
  });

  it("compatibility averages the requested needs", () => {
    expect(scoreListing({ ...base, eventTypeMatch: false }).compatibility).toBe(5);
    expect(scoreListing({ ...base, eventTypeRequested: false, childrenRequested: false }).compatibility).toBe(5);
    expect(scoreListing({ ...base, childrenRequested: false, eventTypeMatch: false }).compatibility).toBe(0);
  });

  it("caps the reviews bonus at 5", () => {
    expect(scoreListing({ ...base, averageRating: 5, reviewCount: 100000 }).reviews).toBe(5);
    expect(scoreListing({ ...base, averageRating: 4, reviewCount: 3 }).reviews).toBeCloseTo((4 * Math.log2(4)) / 10);
    expect(scoreListing({ ...base, averageRating: 5, reviewCount: 0 }).reviews).toBe(0);
  });

  it("orders by score, then verification, then name", () => {
    const a = { score: 80, verificationLevel: 2, displayName: "Zoé" };
    const b = { score: 80, verificationLevel: 4, displayName: "Anna" };
    const c = { score: 90, verificationLevel: 0, displayName: "Marc" };
    const d = { score: 80, verificationLevel: 4, displayName: "Émile" };
    expect([a, b, c, d].sort(compareRanked).map((x) => x.displayName)).toEqual(["Marc", "Anna", "Émile", "Zoé"]);
  });
});
