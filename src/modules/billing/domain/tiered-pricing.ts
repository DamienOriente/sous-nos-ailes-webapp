/**
 * Graduated tiered pricing (same semantics as Stripe `tiers_mode: "graduated"`):
 * with tiers [{upTo: 2, 1490}, {upTo: 9, 990}, {upTo: null, 690}], quantity 4 costs
 * 2 x 14.90 + 2 x 9.90. `upTo` is inclusive and cumulative; null means unbounded.
 */
export type PriceTier = { upTo: number | null; unitAmountCents: number };

export type TierProblem = "empty" | "unbounded_not_last" | "missing_unbounded" | "not_increasing" | "negative_price" | "invalid_bound";

/** Tiers sorted by bound, the unbounded one last. */
export function sortTiers(tiers: readonly PriceTier[]): PriceTier[] {
  return [...tiers].sort((a, b) => (a.upTo ?? Number.POSITIVE_INFINITY) - (b.upTo ?? Number.POSITIVE_INFINITY));
}

/** Null when the tiers are usable; otherwise the first problem found (in the given order). */
export function validateTiers(tiers: readonly PriceTier[]): TierProblem | null {
  if (tiers.length === 0) return "empty";
  let previous = 0;
  for (const [i, t] of tiers.entries()) {
    if (!Number.isInteger(t.unitAmountCents) || t.unitAmountCents < 0) return "negative_price";
    if (t.upTo === null) {
      if (i !== tiers.length - 1) return "unbounded_not_last";
      continue;
    }
    if (!Number.isInteger(t.upTo) || t.upTo < 1) return "invalid_bound";
    if (t.upTo <= previous) return "not_increasing";
    previous = t.upTo;
  }
  return tiers[tiers.length - 1]?.upTo === null ? null : "missing_unbounded";
}

/** Monthly amount in cents for `quantity` units. Quantity 0 costs nothing. */
export function amountForQuantity(tiers: readonly PriceTier[], quantity: number): number {
  if (quantity <= 0) return 0;
  let total = 0;
  let floor = 0;
  for (const t of sortTiers(tiers)) {
    const ceiling = t.upTo ?? Number.POSITIVE_INFINITY;
    const units = Math.min(quantity, ceiling) - floor;
    if (units <= 0) break;
    total += units * t.unitAmountCents;
    floor = ceiling;
    if (quantity <= ceiling) break;
  }
  return total;
}

/** Price of the next unit when `currentQuantity` units are already billed. */
export function nextUnitPrice(tiers: readonly PriceTier[], currentQuantity: number): number {
  return amountForQuantity(tiers, currentQuantity + 1) - amountForQuantity(tiers, currentQuantity);
}

/** Human ranges for display, expressed in listings (unit 1 = the 2nd listing, the first one being included). */
export function tierRanges(tiers: readonly PriceTier[], offset = 1): { from: number; to: number | null; unitAmountCents: number }[] {
  let floor = 0;
  return sortTiers(tiers).map((t) => {
    const range = { from: floor + 1 + offset, to: t.upTo === null ? null : t.upTo + offset, unitAmountCents: t.unitAmountCents };
    floor = t.upTo ?? floor;
    return range;
  });
}
