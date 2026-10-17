import { describe, expect, it } from "vitest";
import { computeBudgetSummary, csvCell, toCsv } from "@/modules/events/domain/budget";

const lines = [
  { id: "l1", category: "Lieu", label: "Domaine", plannedCents: 900_000 },
  { id: "l2", category: "Traiteur", label: "Dîner", plannedCents: 1_200_000 },
  { id: "l3", category: "Enfants", label: "Garde", plannedCents: 100_000 },
];

describe("computeBudgetSummary", () => {
  it("sums planned, committed and paid", () => {
    const s = computeBudgetSummary(lines, [
      { id: "e1", budgetLineId: "l1", amountCents: 255_000, status: "paid" },
      { id: "e2", budgetLineId: "l1", amountCents: 595_000, status: "committed" },
      { id: "e3", budgetLineId: "l2", amountCents: 375_000, status: "paid" },
      { id: "e4", budgetLineId: null, amountCents: 42_000, status: "paid" },
      { id: "e5", budgetLineId: "l3", amountCents: 999, status: "planned" },
    ]);
    expect(s.plannedCents).toBe(2_200_000);
    expect(s.committedCents).toBe(255_000 + 595_000 + 375_000 + 42_000);
    expect(s.paidCents).toBe(255_000 + 375_000 + 42_000);
    expect(s.unallocatedCommittedCents).toBe(42_000);
    expect(s.remainingCents).toBe(2_200_000 - s.committedCents);
    const l1 = s.lines.find((l) => l.id === "l1")!;
    expect(l1.committedCents).toBe(850_000);
    expect(l1.paidCents).toBe(255_000);
    expect(l1.varianceCents).toBe(50_000);
    expect(l1.isOverrun).toBe(false);
    // planned expenses are ignored in totals
    expect(s.lines.find((l) => l.id === "l3")!.committedCents).toBe(0);
  });
  it("flags overruns per line and per category", () => {
    const s = computeBudgetSummary(lines, [{ id: "e1", budgetLineId: "l3", amountCents: 130_000, status: "committed" }]);
    const l3 = s.lines.find((l) => l.id === "l3")!;
    expect(l3.isOverrun).toBe(true);
    expect(l3.varianceCents).toBe(-30_000);
    expect(s.byCategory.find((c) => c.category === "Enfants")).toEqual({ category: "Enfants", plannedCents: 100_000, committedCents: 130_000, paidCents: 0 });
  });
  it("handles an empty budget", () => {
    const s = computeBudgetSummary([], []);
    expect(s.plannedCents).toBe(0);
    expect(s.committedRatio).toBe(0);
    expect(s.lines).toEqual([]);
  });
  it("caps the committed ratio", () => {
    const s = computeBudgetSummary([{ id: "l", category: "x", label: "x", plannedCents: 100 }], [{ id: "e", budgetLineId: "l", amountCents: 1_000_000, status: "committed" }]);
    expect(s.committedRatio).toBe(999);
  });
});

describe("csv", () => {
  it("escapes separators, quotes and formulas", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
  });
  it("produces a BOM + CRLF document", () => {
    const out = toCsv([["a", "b"], [1, "x;y"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain('1;"x;y"\r\n');
  });
});
