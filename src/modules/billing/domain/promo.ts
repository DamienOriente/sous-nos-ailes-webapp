/**
 * Promo code arithmetic. Percent takes precedence over a fixed amount when both
 * are set (Stripe coupons only allow one of them; we mirror that).
 */
export type PromoRule = {
  percentOff: number | null;
  amountOffCents: number | null;
  durationMonths: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
  maxRedemptions: number | null;
  redemptionCount: number;
};

export type PromoCheck = { ok: true } | { ok: false; reason: "inactive" | "not_started" | "expired" | "exhausted" };

export function checkPromoValidity(rule: PromoRule, now: Date = new Date()): PromoCheck {
  if (!rule.isActive) return { ok: false, reason: "inactive" };
  if (rule.validFrom && rule.validFrom.getTime() > now.getTime()) return { ok: false, reason: "not_started" };
  if (rule.validUntil && rule.validUntil.getTime() < now.getTime()) return { ok: false, reason: "expired" };
  if (rule.maxRedemptions !== null && rule.redemptionCount >= rule.maxRedemptions) return { ok: false, reason: "exhausted" };
  return { ok: true };
}

/** Monthly price after discount, never negative, integer cents. */
export function applyPromo(priceCents: number, rule: Pick<PromoRule, "percentOff" | "amountOffCents">): number {
  if (rule.percentOff !== null && rule.percentOff > 0) {
    const pct = Math.min(100, rule.percentOff);
    return Math.max(0, Math.round(priceCents - (priceCents * pct) / 100));
  }
  if (rule.amountOffCents !== null && rule.amountOffCents > 0) return Math.max(0, priceCents - rule.amountOffCents);
  return priceCents;
}

export function normalizePromoCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
