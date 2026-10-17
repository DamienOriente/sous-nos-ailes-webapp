import { describe, expect, it } from "vitest";
import {
  computePricing,
  estimateRange,
  minutesToBillableHoursHundredths,
  totalsFromLines,
  type PricingSettings,
} from "@/domain/pricing";

const settings: PricingSettings = {
  hourlyRateCents: 3500,
  minimumHours: 3,
  minimumAmountCents: null,
  nightSurchargeStartHour: 22,
  nightSurchargePercent: 25,
  sundaySurchargePercent: 0,
  vatMode: "NONE",
  vatRateBps: 2000,
};

describe("pricing engine", () => {
  it("rounds minutes up to the next quarter hour", () => {
    expect(minutesToBillableHoursHundredths(60)).toBe(100);
    expect(minutesToBillableHoursHundredths(61)).toBe(125);
    expect(minutesToBillableHoursHundredths(290)).toBe(500);
  });

  it("applies the minimum hours per provider", () => {
    const result = computePricing({ durationMinutes: 90, providerCount: 2, travelFeeCents: 0, options: [], settings });
    expect(result.appliedMinimumHours).toBe(true);
    expect(result.billableHoursHundredths).toBe(300);
    // 3h × 2 providers × 35 € = 210 €
    expect(result.lines[0].totalCents).toBe(21_000);
    expect(result.totalInclVatCents).toBe(21_000);
  });

  it("adds night surcharge, travel, options and discount with integer cents", () => {
    const result = computePricing({
      durationMinutes: 6 * 60,
      providerCount: 2,
      travelFeeCents: 4_500,
      nightMinutes: 120,
      options: [
        { code: "atelier", label: "Atelier créatif", priceCents: 6_000, pricingUnit: "FLAT" },
        { code: "kit", label: "Kit par intervenant", priceCents: 1_000, pricingUnit: "PER_PROVIDER" },
      ],
      discount: { label: "Remise partenaire", percent: 10 },
      settings,
    });
    const service = 600 * 2 * 3500 / 100; // 42 000
    const night = 200 * 2 * Math.round(3500 * 0.25) / 100; // 2h × 2 × 8,75 € = 3 500
    const subtotal = service + night + 4_500 + 6_000 + 2_000;
    expect(result.subtotalCents).toBe(subtotal);
    expect(result.discountCents).toBe(Math.round(subtotal * 0.1));
    expect(result.totalExclVatCents).toBe(subtotal - Math.round(subtotal * 0.1));
    expect(result.vatCents).toBe(0);
    expect(result.lines.some((l) => l.kind === "DISCOUNT" && l.totalCents < 0)).toBe(true);
  });

  it("computes VAT in STANDARD mode", () => {
    const result = computePricing({
      durationMinutes: 180,
      providerCount: 1,
      travelFeeCents: 0,
      options: [],
      settings: { ...settings, vatMode: "STANDARD", vatRateBps: 2000 },
    });
    expect(result.totalExclVatCents).toBe(10_500);
    expect(result.vatCents).toBe(2_100);
    expect(result.totalInclVatCents).toBe(12_600);
  });

  it("raises the subtotal to the minimum amount when configured", () => {
    const result = computePricing({
      durationMinutes: 180,
      providerCount: 1,
      travelFeeCents: 0,
      options: [],
      settings: { ...settings, minimumAmountCents: 15_000 },
    });
    expect(result.appliedMinimumAmount).toBe(true);
    expect(result.subtotalCents).toBe(15_000);
  });

  it("rejects invalid inputs", () => {
    expect(() =>
      computePricing({ durationMinutes: 180, providerCount: 0, travelFeeCents: 0, options: [], settings }),
    ).toThrow();
    expect(() =>
      computePricing({ durationMinutes: 180, providerCount: 1, travelFeeCents: -5, options: [], settings }),
    ).toThrow();
  });

  it("recomputes totals from edited lines", () => {
    const totals = totalsFromLines(
      [
        { kind: "SERVICE", quantityHundredths: 350, unitPriceCents: 3500 },
        { kind: "DISCOUNT", quantityHundredths: 100, unitPriceCents: -1000 },
      ],
      "STANDARD",
      2000,
    );
    expect(totals.subtotalCents).toBe(12_250);
    expect(totals.discountCents).toBe(1_000);
    expect(totals.totalExclVatCents).toBe(11_250);
    expect(totals.vatCents).toBe(2_250);
  });

  it("produces an indicative range widened by the margin", () => {
    const range = estimateRange({
      base: { durationMinutes: 300, travelFeeCents: 0, options: [], settings },
      minProviders: 1,
      maxProviders: 2,
      marginPercent: 10,
    });
    expect(range.lowCents).toBe(Math.round(17_500 * 0.9));
    expect(range.highCents).toBe(Math.round(35_000 * 1.1));
  });
});
