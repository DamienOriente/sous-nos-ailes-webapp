import { describe, expect, it } from "vitest";
import { amountForQuantity, nextUnitPrice, tierRanges, validateTiers, type PriceTier } from "@/modules/billing/domain/tiered-pricing";

const TIERS: PriceTier[] = [
  { upTo: 2, unitAmountCents: 1490 },
  { upTo: 9, unitAmountCents: 990 },
  { upTo: null, unitAmountCents: 690 },
];

describe("graduated tiered pricing", () => {
  it.each([
    [0, 0],
    [1, 1490],
    [2, 2980],
    [3, 2980 + 990],
    [9, 2980 + 7 * 990],
    [10, 2980 + 7 * 990 + 690],
    [49, 2980 + 7 * 990 + 40 * 690],
  ])("quantity %i costs %i cents", (qty, cents) => {
    expect(amountForQuantity(TIERS, qty)).toBe(cents);
  });

  it("is independent of the tier order given", () => {
    expect(amountForQuantity([...TIERS].reverse(), 5)).toBe(amountForQuantity(TIERS, 5));
  });

  it("prices the next unit at the tier it falls in", () => {
    expect(nextUnitPrice(TIERS, 0)).toBe(1490);
    expect(nextUnitPrice(TIERS, 2)).toBe(990);
    expect(nextUnitPrice(TIERS, 9)).toBe(690);
  });

  it("describes ranges in listings, the first listing being included", () => {
    expect(tierRanges(TIERS)).toEqual([
      { from: 2, to: 3, unitAmountCents: 1490 },
      { from: 4, to: 10, unitAmountCents: 990 },
      { from: 11, to: null, unitAmountCents: 690 },
    ]);
  });

  it("rejects unusable tiers", () => {
    expect(validateTiers(TIERS)).toBeNull();
    expect(validateTiers([])).toBe("empty");
    expect(validateTiers([{ upTo: 2, unitAmountCents: 100 }])).toBe("missing_unbounded");
    expect(validateTiers([{ upTo: null, unitAmountCents: 100 }, { upTo: 3, unitAmountCents: 50 }])).toBe("unbounded_not_last");
    expect(validateTiers([{ upTo: 3, unitAmountCents: 100 }, { upTo: 3, unitAmountCents: 50 }, { upTo: null, unitAmountCents: 10 }])).toBe("not_increasing");
    expect(validateTiers([{ upTo: 3, unitAmountCents: -1 }, { upTo: null, unitAmountCents: 10 }])).toBe("negative_price");
    expect(validateTiers([{ upTo: 0, unitAmountCents: 1 }, { upTo: null, unitAmountCents: 10 }])).toBe("invalid_bound");
  });
});
