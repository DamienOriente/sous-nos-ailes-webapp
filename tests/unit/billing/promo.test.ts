import { describe, expect, it } from "vitest";
import { applyPromo, checkPromoValidity, normalizePromoCode } from "@/modules/billing/domain/promo";

const base = { percentOff: null, amountOffCents: null, durationMonths: null, validFrom: null, validUntil: null, isActive: true, maxRedemptions: null, redemptionCount: 0 };

describe("applyPromo", () => {
  it("applies a percentage with integer rounding", () => {
    expect(applyPromo(990, { percentOff: 20, amountOffCents: null })).toBe(792);
    expect(applyPromo(1990, { percentOff: 20, amountOffCents: null })).toBe(1592);
    expect(applyPromo(999, { percentOff: 33, amountOffCents: null })).toBe(669);
  });
  it("applies a fixed amount, never below zero", () => {
    expect(applyPromo(990, { percentOff: null, amountOffCents: 500 })).toBe(490);
    expect(applyPromo(990, { percentOff: null, amountOffCents: 5000 })).toBe(0);
  });
  it("percentage wins when both are set; caps at 100 %", () => {
    expect(applyPromo(990, { percentOff: 50, amountOffCents: 100 })).toBe(495);
    expect(applyPromo(990, { percentOff: 150, amountOffCents: null })).toBe(0);
  });
  it("no discount when rule is empty", () => {
    expect(applyPromo(990, { percentOff: null, amountOffCents: null })).toBe(990);
  });
});

describe("checkPromoValidity", () => {
  const now = new Date("2026-10-17T00:00:00Z");
  it("accepts an active, unlimited code", () => expect(checkPromoValidity(base, now)).toEqual({ ok: true }));
  it("rejects inactive, not started, expired and exhausted codes", () => {
    expect(checkPromoValidity({ ...base, isActive: false }, now)).toEqual({ ok: false, reason: "inactive" });
    expect(checkPromoValidity({ ...base, validFrom: new Date("2026-11-01") }, now)).toEqual({ ok: false, reason: "not_started" });
    expect(checkPromoValidity({ ...base, validUntil: new Date("2026-10-01") }, now)).toEqual({ ok: false, reason: "expired" });
    expect(checkPromoValidity({ ...base, maxRedemptions: 3, redemptionCount: 3 }, now)).toEqual({ ok: false, reason: "exhausted" });
  });
});

describe("normalizePromoCode", () => {
  it("uppercases and strips whitespace", () => expect(normalizePromoCode("  bien venue20 ")).toBe("BIENVENUE20"));
});
