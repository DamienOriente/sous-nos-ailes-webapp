import { z } from "zod";

/**
 * Common quote format (2026-10-18) so organisers compare providers on the same lines: total,
 * what is included or not, deposit, balance due date, cancellation terms, validity.
 * Cancellation presets are the professional's own commercial terms, chosen by them; the
 * platform does not impose or guarantee them.
 */
export const CANCELLATION_POLICIES = ["flexible", "moderate", "strict", "custom"] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];

export const CANCELLATION_LABELS: Record<CancellationPolicy, { label: string; description: string }> = {
  flexible: { label: "Souple", description: "Acompte remboursé en cas d'annulation au moins 30 jours avant." },
  moderate: { label: "Modérée", description: "Acompte conservé, rien d'autre dû en cas d'annulation au moins 30 jours avant." },
  strict: { label: "Stricte", description: "Acompte conservé, la moitié du solde due à moins de 60 jours." },
  custom: { label: "Conditions particulières", description: "Voir le détail rédigé par le professionnel." },
};

export type QuoteLine = { label: string; quantity: number; unitCents: number };

export type StructuredQuote = {
  totalCents: number;
  lineItems: QuoteLine[];
  inclusions: string[];
  exclusions: string[];
  depositCents: number;
  balanceDueDays: number | null;
  cancellationPolicy: CancellationPolicy;
  cancellationTerms: string | null;
  validUntil: string | null;
  note: string | null;
};

export function linesTotal(lines: readonly QuoteLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitCents, 0);
}

/** One entry per line of a textarea, trimmed, deduplicated, without empty lines. */
export function splitLines(v: string | undefined, max = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (v ?? "").split(/\r?\n/)) {
    const t = raw.replace(/^[-*•]\s*/, "").trim().slice(0, 120);
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out.slice(0, max);
}

const euros = z.coerce.number().min(0).max(1_000_000);

export const quoteFormSchema = z
  .object({
    lines: z
      .array(z.object({ label: z.string().trim().min(1).max(120), quantity: z.coerce.number().int().min(1).max(10_000), unitEuros: euros }))
      .max(30)
      .default([]),
    totalEuros: euros.optional(),
    inclusions: z.string().max(3000).optional().default(""),
    exclusions: z.string().max(3000).optional().default(""),
    depositEuros: euros.optional().default(0),
    balanceDueDays: z.coerce.number().int().min(0).max(365).nullable().optional(),
    cancellationPolicy: z.enum(CANCELLATION_POLICIES).default("moderate"),
    cancellationTerms: z.string().trim().max(1500).optional().default(""),
    validUntil: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date au format AAAA-MM-JJ").optional().default(""),
    note: z.string().trim().max(2000).optional().default(""),
    message: z.string().trim().max(3000).optional().default(""),
    quoteFileId: z.uuid().optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (!v.lines.length && v.totalEuros === undefined) ctx.addIssue({ code: "custom", path: ["totalEuros"], message: "Indiquez le montant total ou détaillez les lignes du devis" });
    if (v.cancellationPolicy === "custom" && !v.cancellationTerms) ctx.addIssue({ code: "custom", path: ["cancellationTerms"], message: "Décrivez vos conditions d'annulation" });
  });
export type QuoteFormInput = z.infer<typeof quoteFormSchema>;

const cents = (eur: number) => Math.round(eur * 100);

/** Form → stored quote. With detailed lines, the total is their sum (no mismatch possible). */
export function toStructuredQuote(input: QuoteFormInput): StructuredQuote {
  const lineItems = input.lines.map((l) => ({ label: l.label, quantity: l.quantity, unitCents: cents(l.unitEuros) }));
  const totalCents = lineItems.length ? linesTotal(lineItems) : cents(input.totalEuros ?? 0);
  const depositCents = Math.min(cents(input.depositEuros), totalCents);
  return {
    totalCents,
    lineItems,
    inclusions: splitLines(input.inclusions),
    exclusions: splitLines(input.exclusions),
    depositCents,
    balanceDueDays: input.balanceDueDays ?? null,
    cancellationPolicy: input.cancellationPolicy,
    cancellationTerms: input.cancellationTerms || null,
    validUntil: input.validUntil || null,
    note: input.note || null,
  };
}

// ── Comparison ──────────────────────────────────────────────────────────────
export type ComparableQuote = StructuredQuote & { inquiryId: string; professionalName: string; categoryName: string; status: string; version: number };

export type QuoteComparison = {
  quotes: (ComparableQuote & { perGuestCents: number | null; depositPercent: number; expired: boolean; cheapest: boolean })[];
  /** Union of everything mentioned as included or excluded, in first-seen order. */
  items: string[];
  /** For each item: per quote, included / excluded / not mentioned. */
  matrix: Record<string, ("included" | "excluded" | "unknown")[]>;
};

const norm = (s: string) => s.trim().toLowerCase();

export function compareQuotes(quotes: readonly ComparableQuote[], guests: number | null, today: string): QuoteComparison {
  const valid = quotes.filter((q) => !(q.validUntil && q.validUntil < today));
  const min = valid.length ? Math.min(...valid.map((q) => q.totalCents)) : null;
  const items: string[] = [];
  const seen = new Set<string>();
  for (const q of quotes) {
    for (const i of [...q.inclusions, ...q.exclusions]) {
      if (!seen.has(norm(i))) {
        seen.add(norm(i));
        items.push(i);
      }
    }
  }
  const matrix: QuoteComparison["matrix"] = {};
  for (const item of items) {
    matrix[item] = quotes.map((q) => (q.inclusions.some((x) => norm(x) === norm(item)) ? "included" : q.exclusions.some((x) => norm(x) === norm(item)) ? "excluded" : "unknown"));
  }
  return {
    quotes: quotes.map((q) => ({
      ...q,
      perGuestCents: guests && guests > 0 ? Math.round(q.totalCents / guests) : null,
      depositPercent: q.totalCents > 0 ? Math.round((q.depositCents / q.totalCents) * 100) : 0,
      expired: Boolean(q.validUntil && q.validUntil < today),
      cheapest: min !== null && q.totalCents === min && valid.length > 1 && !(q.validUntil && q.validUntil < today),
    })),
    items,
    matrix,
  };
}
