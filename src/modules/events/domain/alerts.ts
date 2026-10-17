/** Operational alerts of the dashboard — pure, computed from aggregates. */
export type AlertInput = {
  daysUntil: number | null;
  overdueTasks: number;
  providersPendingConfirmation: number;
  budgetPlannedCents: number;
  budgetCommittedCents: number;
  /** Categories the organiser is looking for with no provider slot filled (status ≠ shortlisted without pro). */
  categoriesWithoutProvider: readonly string[];
  overrunLines: readonly string[];
};

export type Alert = { key: string; severity: "warning" | "danger" | "info"; title: string; description?: string; href?: string };

export function computeAlerts(input: AlertInput, base: string): Alert[] {
  const alerts: Alert[] = [];
  if (input.overdueTasks > 0) {
    alerts.push({
      key: "tasks-overdue",
      severity: "warning",
      title: `${input.overdueTasks} tâche${input.overdueTasks > 1 ? "s" : ""} en retard`,
      description: "Des échéances sont dépassées : replanifiez-les ou marquez-les comme faites.",
      href: `${base}/taches?filtre=retard`,
    });
  }
  if (input.providersPendingConfirmation > 0 && input.daysUntil !== null && input.daysUntil <= 30) {
    alerts.push({
      key: "providers-unconfirmed",
      severity: "danger",
      title: `${input.providersPendingConfirmation} prestataire${input.providersPendingConfirmation > 1 ? "s" : ""} sans confirmation à J-${Math.max(input.daysUntil, 0)}`,
      description: "Relancez-les ou confirmez leur prestation pour sécuriser le jour J.",
      href: `${base}/prestataires`,
    });
  }
  if (input.budgetPlannedCents > 0 && input.budgetCommittedCents > input.budgetPlannedCents) {
    alerts.push({
      key: "budget-overrun",
      severity: "danger",
      title: "Budget dépassé",
      description: `Les dépenses engagées dépassent le budget prévu${input.overrunLines.length ? ` (${input.overrunLines.slice(0, 3).join(", ")})` : ""}.`,
      href: `${base}/budget`,
    });
  } else if (input.overrunLines.length > 0) {
    alerts.push({
      key: "budget-line-overrun",
      severity: "warning",
      title: `${input.overrunLines.length} poste${input.overrunLines.length > 1 ? "s" : ""} de budget dépassé${input.overrunLines.length > 1 ? "s" : ""}`,
      description: input.overrunLines.slice(0, 3).join(", "),
      href: `${base}/budget`,
    });
  }
  if (input.categoriesWithoutProvider.length > 0) {
    alerts.push({
      key: "categories-missing",
      severity: "info",
      title: `${input.categoriesWithoutProvider.length} catégorie${input.categoriesWithoutProvider.length > 1 ? "s" : ""} recherchée${input.categoriesWithoutProvider.length > 1 ? "s" : ""} sans prestataire`,
      description: input.categoriesWithoutProvider.slice(0, 4).join(", "),
      href: `${base}/prestataires`,
    });
  }
  return alerts;
}
