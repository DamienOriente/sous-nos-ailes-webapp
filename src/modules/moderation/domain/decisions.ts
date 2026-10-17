import type { ProfessionalStatus } from "@/modules/professionals/domain/status";

/**
 * Pure rules of the moderation workflow. Decisions are appended to a case and
 * never edited; every one of them carries a reason shown to the professional
 * (except internal notes).
 */
export const DECISIONS = ["approve", "reject", "request_changes", "suspend", "reinstate", "dismiss", "escalate", "note"] as const;
export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABELS: Record<Decision, string> = {
  approve: "Approuver et publier",
  reject: "Refuser",
  request_changes: "Demander des modifications",
  suspend: "Suspendre",
  reinstate: "Rétablir",
  dismiss: "Classer sans suite",
  escalate: "Escalader",
  note: "Note interne",
};

export const MIN_REASON_LENGTH = 10;

/** Decisions that close the case. `note` and `escalate` keep it open. */
export function closesCase(decision: Decision): boolean {
  return decision === "approve" || decision === "reject" || decision === "request_changes" || decision === "suspend" || decision === "reinstate" || decision === "dismiss";
}

export function caseStatusAfter(decision: Decision): "open" | "in_review" | "resolved" | "dismissed" {
  if (decision === "dismiss") return "dismissed";
  if (closesCase(decision)) return "resolved";
  return "in_review";
}

/** Target listing status for decisions that act on a professional. `null` = no status change. */
export function targetProfessionalStatus(decision: Decision, current: ProfessionalStatus): ProfessionalStatus | null {
  switch (decision) {
    case "approve":
      return "published";
    case "reject":
      return "rejected";
    case "request_changes":
      // A published listing stays visible: the request concerns the next version.
      return "changes_requested";
    case "suspend":
      return "suspended";
    case "reinstate":
      return current === "suspended" ? "published" : null;
    default:
      return null;
  }
}

export function validateReason(decision: Decision, reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < MIN_REASON_LENGTH) return `Le motif doit faire au moins ${MIN_REASON_LENGTH} caractères.`;
  if (trimmed.length > 2000) return "Motif trop long (2000 caractères max).";
  if (decision === "approve" && /^(ok|oui|approve[dr]?|valid[eé]?)\.?$/i.test(trimmed)) return "Précisez ce qui a été vérifié avant d'approuver.";
  return null;
}

export const CASE_KIND_LABELS: Record<string, string> = {
  profile_review: "Nouvelle fiche",
  profile_update_review: "Modification de fiche publiée",
  report: "Signalement",
  review_moderation: "Avis à modérer",
  appeal: "Recours",
};

export const CASE_STATUS_LABELS: Record<string, string> = { open: "Ouvert", in_review: "En cours", resolved: "Résolu", dismissed: "Classé" };
