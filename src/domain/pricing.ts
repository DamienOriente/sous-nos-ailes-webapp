// Pricing engine. Pure, integer-cents arithmetic. All rules run server-side.

export type VatMode = "NONE" | "STANDARD";
export type PricingUnit = "FLAT" | "PER_HOUR" | "PER_PROVIDER";
export type LineKind = "SERVICE" | "TRAVEL" | "OPTION" | "SURCHARGE" | "DISCOUNT" | "OTHER";

export type PricingSettings = {
  hourlyRateCents: number;
  minimumHours: number;
  minimumAmountCents: number | null;
  nightSurchargeStartHour: number;
  nightSurchargePercent: number;
  sundaySurchargePercent: number;
  vatMode: VatMode;
  vatRateBps: number;
};

export type PricingOption = {
  code: string;
  label: string;
  priceCents: number;
  pricingUnit: PricingUnit;
};

export type Discount = { label: string; amountCents?: number; percent?: number };

export type PricingInput = {
  durationMinutes: number;
  providerCount: number;
  travelFeeCents: number;
  options: PricingOption[];
  nightMinutes?: number;
  isSunday?: boolean;
  discount?: Discount | null;
  settings: PricingSettings;
};

export type ComputedLine = {
  kind: LineKind;
  label: string;
  description?: string;
  quantityHundredths: number;
  unitPriceCents: number;
  totalCents: number;
};

export type PricingResult = {
  lines: ComputedLine[];
  subtotalCents: number;
  discountCents: number;
  totalExclVatCents: number;
  vatCents: number;
  totalInclVatCents: number;
  billableHoursHundredths: number;
  appliedMinimumHours: boolean;
  appliedMinimumAmount: boolean;
};

export class PricingError extends Error {}

function assertInt(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0) throw new PricingError(`${name} must be a non-negative integer`);
}

/** Rounds minutes up to the next quarter hour, then converts to hundredths of hours. */
export function minutesToBillableHoursHundredths(minutes: number): number {
  const quarterHours = Math.ceil(minutes / 15);
  return Math.round((quarterHours * 15 * 100) / 60);
}

export function lineTotal(quantityHundredths: number, unitPriceCents: number): number {
  return Math.round((quantityHundredths * unitPriceCents) / 100);
}

export function formatHoursFromHundredths(hundredths: number): string {
  const hours = Math.floor(hundredths / 100);
  const minutes = Math.round(((hundredths % 100) / 100) * 60);
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

export function computePricing(input: PricingInput): PricingResult {
  const { settings } = input;
  assertInt(input.durationMinutes, "durationMinutes");
  assertInt(input.providerCount, "providerCount");
  assertInt(input.travelFeeCents, "travelFeeCents");
  assertInt(settings.hourlyRateCents, "hourlyRateCents");
  if (input.providerCount === 0) throw new PricingError("providerCount must be at least 1");

  const rawHours = minutesToBillableHoursHundredths(input.durationMinutes);
  const minimumHours = Math.max(0, settings.minimumHours) * 100;
  const appliedMinimumHours = rawHours < minimumHours;
  const billableHoursHundredths = Math.max(rawHours, minimumHours);

  const lines: ComputedLine[] = [];

  const serviceQuantity = billableHoursHundredths * input.providerCount;
  const serviceLine: ComputedLine = {
    kind: "SERVICE",
    label: `Garde et animation — ${input.providerCount} intervenant·e${input.providerCount > 1 ? "s" : ""} × ${formatHoursFromHundredths(billableHoursHundredths)}`,
    description: appliedMinimumHours
      ? `Minimum de prestation de ${settings.minimumHours} h appliqué par intervenant·e.`
      : undefined,
    quantityHundredths: serviceQuantity,
    unitPriceCents: settings.hourlyRateCents,
    totalCents: lineTotal(serviceQuantity, settings.hourlyRateCents),
  };
  lines.push(serviceLine);

  const nightMinutes = Math.min(input.nightMinutes ?? 0, input.durationMinutes);
  if (nightMinutes > 0 && settings.nightSurchargePercent > 0) {
    const nightHours = Math.round((nightMinutes * 100) / 60);
    const quantity = nightHours * input.providerCount;
    const unit = Math.round((settings.hourlyRateCents * settings.nightSurchargePercent) / 100);
    lines.push({
      kind: "SURCHARGE",
      label: `Majoration de nuit (+${settings.nightSurchargePercent} % à partir de ${settings.nightSurchargeStartHour} h)`,
      quantityHundredths: quantity,
      unitPriceCents: unit,
      totalCents: lineTotal(quantity, unit),
    });
  }

  if (input.isSunday && settings.sundaySurchargePercent > 0) {
    const amount = Math.round((serviceLine.totalCents * settings.sundaySurchargePercent) / 100);
    lines.push({
      kind: "SURCHARGE",
      label: `Majoration dimanche (+${settings.sundaySurchargePercent} %)`,
      quantityHundredths: 100,
      unitPriceCents: amount,
      totalCents: amount,
    });
  }

  if (input.travelFeeCents > 0) {
    lines.push({
      kind: "TRAVEL",
      label: "Forfait déplacement",
      quantityHundredths: 100,
      unitPriceCents: input.travelFeeCents,
      totalCents: input.travelFeeCents,
    });
  }

  for (const option of input.options) {
    assertInt(option.priceCents, `option ${option.code} priceCents`);
    let quantity = 100;
    let description: string | undefined;
    if (option.pricingUnit === "PER_HOUR") {
      quantity = billableHoursHundredths;
      description = "Tarif horaire";
    } else if (option.pricingUnit === "PER_PROVIDER") {
      quantity = input.providerCount * 100;
      description = "Par intervenant·e";
    }
    lines.push({
      kind: "OPTION",
      label: option.label,
      description,
      quantityHundredths: quantity,
      unitPriceCents: option.priceCents,
      totalCents: lineTotal(quantity, option.priceCents),
    });
  }

  let subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  let appliedMinimumAmount = false;
  if (settings.minimumAmountCents && subtotalCents < settings.minimumAmountCents) {
    const adjustment = settings.minimumAmountCents - subtotalCents;
    lines.push({
      kind: "OTHER",
      label: "Ajustement au minimum de prestation",
      quantityHundredths: 100,
      unitPriceCents: adjustment,
      totalCents: adjustment,
    });
    subtotalCents = settings.minimumAmountCents;
    appliedMinimumAmount = true;
  }

  let discountCents = 0;
  if (input.discount) {
    if (input.discount.amountCents !== undefined) {
      assertInt(input.discount.amountCents, "discount.amountCents");
      discountCents = Math.min(input.discount.amountCents, subtotalCents);
    } else if (input.discount.percent !== undefined) {
      if (input.discount.percent < 0 || input.discount.percent > 100) {
        throw new PricingError("discount.percent must be between 0 and 100");
      }
      discountCents = Math.round((subtotalCents * input.discount.percent) / 100);
    }
    if (discountCents > 0) {
      lines.push({
        kind: "DISCOUNT",
        label: input.discount.label,
        quantityHundredths: 100,
        unitPriceCents: -discountCents,
        totalCents: -discountCents,
      });
    }
  }

  const totalExclVatCents = subtotalCents - discountCents;
  const vatCents = settings.vatMode === "STANDARD" ? Math.round((totalExclVatCents * settings.vatRateBps) / 10_000) : 0;

  return {
    lines,
    subtotalCents,
    discountCents,
    totalExclVatCents,
    vatCents,
    totalInclVatCents: totalExclVatCents + vatCents,
    billableHoursHundredths,
    appliedMinimumHours,
    appliedMinimumAmount,
  };
}

/** Recomputes totals from arbitrary (possibly hand-edited) lines. */
export function totalsFromLines(
  lines: Array<{ quantityHundredths: number; unitPriceCents: number; kind: LineKind }>,
  vatMode: VatMode,
  vatRateBps: number,
): Pick<PricingResult, "subtotalCents" | "discountCents" | "totalExclVatCents" | "vatCents" | "totalInclVatCents"> & {
  lineTotals: number[];
} {
  const lineTotals = lines.map((line) => lineTotal(line.quantityHundredths, line.unitPriceCents));
  let subtotalCents = 0;
  let discountCents = 0;
  lines.forEach((line, index) => {
    const total = lineTotals[index];
    if (line.kind === "DISCOUNT" || total < 0) discountCents += -total;
    else subtotalCents += total;
  });
  const totalExclVatCents = subtotalCents - discountCents;
  const vatCents = vatMode === "STANDARD" ? Math.round((totalExclVatCents * vatRateBps) / 10_000) : 0;
  return { lineTotals, subtotalCents, discountCents, totalExclVatCents, vatCents, totalInclVatCents: totalExclVatCents + vatCents };
}

/** Indicative public range: low = minimum team, high = suggested team, both widened by a margin. */
export function estimateRange(input: {
  base: Omit<PricingInput, "providerCount" | "discount">;
  minProviders: number;
  maxProviders: number;
  marginPercent: number;
}): { lowCents: number; highCents: number } {
  const low = computePricing({ ...input.base, providerCount: Math.max(1, input.minProviders), discount: null });
  const high = computePricing({ ...input.base, providerCount: Math.max(1, input.maxProviders), discount: null });
  const factor = Math.max(0, input.marginPercent) / 100;
  return {
    lowCents: Math.round(low.totalInclVatCents * (1 - factor)),
    highCents: Math.round(high.totalInclVatCents * (1 + factor)),
  };
}
