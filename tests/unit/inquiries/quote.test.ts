import { describe, expect, it } from "vitest";
import { compareQuotes, quoteFormSchema, splitLines, toStructuredQuote, type ComparableQuote } from "@/modules/inquiries/domain/quote";

const base = (over: Partial<ComparableQuote>): ComparableQuote => ({
  inquiryId: "i",
  professionalName: "P",
  categoryName: "Traiteur",
  status: "quoted",
  version: 1,
  totalCents: 100_000,
  lineItems: [],
  inclusions: [],
  exclusions: [],
  depositCents: 30_000,
  balanceDueDays: 30,
  cancellationPolicy: "moderate",
  cancellationTerms: null,
  validUntil: null,
  note: null,
  ...over,
});

describe("structured quotes", () => {
  it("sums detailed lines and caps the deposit at the total", () => {
    const parsed = quoteFormSchema.parse({ lines: [{ label: "Menu", quantity: 100, unitEuros: 45 }, { label: "Service", quantity: 1, unitEuros: 600 }], depositEuros: 99_999 });
    const q = toStructuredQuote(parsed);
    expect(q.totalCents).toBe(100 * 4500 + 60_000);
    expect(q.depositCents).toBe(q.totalCents);
  });

  it("requires a total or lines, and terms for a custom policy", () => {
    expect(quoteFormSchema.safeParse({}).success).toBe(false);
    expect(quoteFormSchema.safeParse({ totalEuros: 100, cancellationPolicy: "custom" }).success).toBe(false);
    expect(quoteFormSchema.safeParse({ totalEuros: 100, cancellationPolicy: "custom", cancellationTerms: "Rien dû avant J-15" }).success).toBe(true);
  });

  it("splits inclusions one per line, without bullets or duplicates", () => {
    expect(splitLines("- Vaisselle\n• vaisselle\n\n  Service à table ")).toEqual(["Vaisselle", "Service à table"]);
  });

  it("compares per guest, deposit share, cheapest valid quote and the inclusion matrix", () => {
    const c = compareQuotes(
      [
        base({ inquiryId: "a", totalCents: 900_000, depositCents: 270_000, inclusions: ["Vaisselle", "Service"], exclusions: ["Boissons"] }),
        base({ inquiryId: "b", totalCents: 800_000, depositCents: 400_000, inclusions: ["vaisselle", "Boissons"] }),
        base({ inquiryId: "c", totalCents: 500_000, validUntil: "2026-01-01" }),
      ],
      100,
      "2026-10-18",
    );
    expect(c.quotes.map((q) => q.perGuestCents)).toEqual([9000, 8000, 5000]);
    expect(c.quotes[0]?.depositPercent).toBe(30);
    expect(c.quotes.find((q) => q.cheapest)?.inquiryId).toBe("b"); // c is expired
    expect(c.quotes[2]?.expired).toBe(true);
    expect(c.items).toEqual(["Vaisselle", "Service", "Boissons"]);
    expect(c.matrix.Boissons).toEqual(["excluded", "included", "unknown"]);
  });
});
