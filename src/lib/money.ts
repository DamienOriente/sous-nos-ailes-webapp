const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEuros(cents: number): string {
  return euroFormatter.format(cents / 100);
}

/** Parses "35", "35,50", "35.50", "1 250,00" into integer cents. Returns null when invalid. */
export function parseEurosToCents(input: string): number | null {
  const cleaned = input.replace(/\s|€/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const wholeAbs = Math.abs(Number(whole));
  const fractionCents = Number((fraction + "00").slice(0, 2));
  return sign * (wholeAbs * 100 + fractionCents);
}

export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function formatPercent(value: number): string {
  return `${value.toString().replace(".", ",")} %`;
}
