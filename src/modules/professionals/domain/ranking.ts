/**
 * Directory ranking. Documented weights (total 100 + capped review bonus):
 *  - trade match ............ 30  (primary category 30, secondary 20, text-only match 10)
 *  - proximity .............. 20  (linear decay: 20 at 0 km → 0 at `decayKm`, default 100 km)
 *  - availability ........... 15  (available on the requested date 15, unknown 8, not requested 10)
 *  - needs compatibility .... 10  (event type covered 10, children option when requested 10, unknown 5)
 *  - completeness ........... 15  (score / 100 × 15)
 *  - verification ........... 10  (level / 5 × 10)
 *  - reviews bonus .......... ≤ 5 (average rating × log2(count + 1) / 10, capped at 5)
 * Sponsored placements are never ranked here: they are displayed in a separate labelled block.
 */
export type RankingInput = {
  categoryMatch: "primary" | "secondary" | "text" | "none";
  distanceKm: number | null;
  decayKm?: number;
  /** null = no date requested; true/false = known availability for the requested date. */
  availableOnDate: boolean | null;
  eventTypeRequested: boolean;
  eventTypeMatch: boolean;
  childrenRequested: boolean;
  acceptsChildren: boolean;
  completenessScore: number;
  verificationLevel: number;
  averageRating: number | null;
  reviewCount: number;
};

export type RankingBreakdown = { trade: number; proximity: number; availability: number; compatibility: number; completeness: number; verification: number; reviews: number; total: number };

export function scoreListing(i: RankingInput): RankingBreakdown {
  const trade = i.categoryMatch === "primary" ? 30 : i.categoryMatch === "secondary" ? 20 : i.categoryMatch === "text" ? 10 : 0;

  const decay = i.decayKm ?? 100;
  const proximity = i.distanceKm === null ? 10 : Math.max(0, 20 * (1 - Math.min(i.distanceKm, decay) / decay));

  const availability = i.availableOnDate === null ? 10 : i.availableOnDate ? 15 : 0;

  let compatibility = 5;
  if (i.eventTypeRequested || i.childrenRequested) {
    const parts: number[] = [];
    if (i.eventTypeRequested) parts.push(i.eventTypeMatch ? 10 : 0);
    if (i.childrenRequested) parts.push(i.acceptsChildren ? 10 : 0);
    compatibility = parts.reduce((a, b) => a + b, 0) / parts.length;
  }

  const completeness = (Math.max(0, Math.min(100, i.completenessScore)) / 100) * 15;
  const verification = (Math.max(0, Math.min(5, i.verificationLevel)) / 5) * 10;
  const reviews = i.averageRating && i.reviewCount > 0 ? Math.min(5, (i.averageRating * Math.log2(i.reviewCount + 1)) / 10) : 0;

  const total = trade + proximity + availability + compatibility + completeness + verification + reviews;
  return { trade, proximity, availability, compatibility, completeness, verification, reviews, total: Math.round(total * 100) / 100 };
}

/** Stable ordering: score desc, then verification desc, then name asc. */
export function compareRanked<T extends { score: number; verificationLevel: number; displayName: string }>(a: T, b: T): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.verificationLevel !== a.verificationLevel) return b.verificationLevel - a.verificationLevel;
  return a.displayName.localeCompare(b.displayName, "fr");
}
