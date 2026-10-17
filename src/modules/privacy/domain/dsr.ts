/** Data subject requests (GDPR art. 15-21): pure helpers shared by UI and services. */
export const DSR_KINDS = ["access", "rectification", "erasure", "restriction", "portability", "objection"] as const;
export type DsrKind = (typeof DSR_KINDS)[number];

export const DSR_KIND_LABELS: Record<DsrKind, string> = {
  access: "Accès à mes données",
  rectification: "Rectification",
  erasure: "Suppression (droit à l'effacement)",
  restriction: "Limitation du traitement",
  portability: "Portabilité",
  objection: "Opposition à un traitement",
};

export const DSR_STATUSES = ["received", "in_progress", "completed", "rejected"] as const;
export type DsrStatus = (typeof DSR_STATUSES)[number];

export const DSR_STATUS_LABELS: Record<DsrStatus, string> = {
  received: "Reçue",
  in_progress: "En cours",
  completed: "Traitée",
  rejected: "Refusée",
};

/** Legal response time: one month from receipt (extendable, tracked manually by staff). */
export const DSR_RESPONSE_DAYS = 30;

export function computeDueAt(receivedAt: Date, days = DSR_RESPONSE_DAYS): Date {
  return new Date(receivedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Kinds a user can file from their account; access is served instantly by the export, so it is recorded for the register only. */
export const SELF_SERVICE_KINDS: readonly DsrKind[] = ["rectification", "erasure", "restriction", "objection", "portability"];

export function daysUntil(dueAt: Date, now = new Date()): number {
  return Math.ceil((dueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function dueTone(dueAt: Date, status: DsrStatus, now = new Date()): "neutral" | "warning" | "danger" | "success" {
  if (status === "completed") return "success";
  if (status === "rejected") return "neutral";
  const d = daysUntil(dueAt, now);
  if (d < 0) return "danger";
  if (d <= 7) return "warning";
  return "neutral";
}
