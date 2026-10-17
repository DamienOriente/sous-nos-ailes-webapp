/**
 * Budget arithmetic — pure. Amounts are integer cents.
 * planned  = sum of budget lines
 * committed = expenses with status committed or paid (money promised)
 * paid     = expenses with status paid
 */
export type BudgetLineInput = { id: string; category: string; label: string; plannedCents: number; eventProfessionalId?: string | null };
export type ExpenseInput = { id: string; budgetLineId: string | null; amountCents: number; status: "planned" | "committed" | "paid" };

export type BudgetLineSummary = BudgetLineInput & {
  committedCents: number;
  paidCents: number;
  /** planned - committed (negative = overrun). */
  varianceCents: number;
  isOverrun: boolean;
};

export type BudgetSummary = {
  plannedCents: number;
  committedCents: number;
  paidCents: number;
  remainingCents: number;
  /** Committed expenses not attached to any line. */
  unallocatedCommittedCents: number;
  lines: BudgetLineSummary[];
  byCategory: Array<{ category: string; plannedCents: number; committedCents: number; paidCents: number }>;
  /** 0..100 share of planned budget already committed (capped at 999 for display). */
  committedRatio: number;
};

export function computeBudgetSummary(lines: readonly BudgetLineInput[], expenses: readonly ExpenseInput[]): BudgetSummary {
  const byLine = new Map<string, { committed: number; paid: number }>();
  let unallocated = 0;
  let committedTotal = 0;
  let paidTotal = 0;
  for (const e of expenses) {
    if (e.status === "planned") continue;
    committedTotal += e.amountCents;
    if (e.status === "paid") paidTotal += e.amountCents;
    if (!e.budgetLineId) {
      unallocated += e.amountCents;
      continue;
    }
    const acc = byLine.get(e.budgetLineId) ?? { committed: 0, paid: 0 };
    acc.committed += e.amountCents;
    if (e.status === "paid") acc.paid += e.amountCents;
    byLine.set(e.budgetLineId, acc);
  }
  const summaries: BudgetLineSummary[] = lines.map((l) => {
    const acc = byLine.get(l.id) ?? { committed: 0, paid: 0 };
    const variance = l.plannedCents - acc.committed;
    return { ...l, committedCents: acc.committed, paidCents: acc.paid, varianceCents: variance, isOverrun: variance < 0 };
  });
  const planned = lines.reduce((s, l) => s + l.plannedCents, 0);
  const categories = new Map<string, { planned: number; committed: number; paid: number }>();
  for (const l of summaries) {
    const c = categories.get(l.category) ?? { planned: 0, committed: 0, paid: 0 };
    c.planned += l.plannedCents;
    c.committed += l.committedCents;
    c.paid += l.paidCents;
    categories.set(l.category, c);
  }
  return {
    plannedCents: planned,
    committedCents: committedTotal,
    paidCents: paidTotal,
    remainingCents: planned - committedTotal,
    unallocatedCommittedCents: unallocated,
    lines: summaries,
    byCategory: [...categories.entries()].map(([category, c]) => ({ category, plannedCents: c.planned, committedCents: c.committed, paidCents: c.paid })),
    committedRatio: planned > 0 ? Math.min(999, Math.round((committedTotal / planned) * 100)) : 0,
  };
}

/** Escape a CSV cell (RFC 4180, ; separator for French spreadsheets). */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Neutralise formula injection in spreadsheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  return `﻿${rows.map((r) => r.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
