export const PROVIDER_STATUSES = ["shortlisted", "requested", "quoted", "confirmed", "declined", "cancelled"] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const PROVIDER_STATUS_LABELS: Record<ProviderStatus, string> = {
  shortlisted: "Présélectionné",
  requested: "Demande envoyée",
  quoted: "Devis reçu",
  confirmed: "Confirmé",
  declined: "Décliné",
  cancelled: "Annulé",
};

export const PROVIDER_STATUS_TONES: Record<ProviderStatus, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  shortlisted: "neutral",
  requested: "info",
  quoted: "warning",
  confirmed: "success",
  declined: "danger",
  cancelled: "neutral",
};

/** shortlisted → requested → quoted → confirmed | declined | cancelled (with a few shortcuts). */
export const PROVIDER_TRANSITIONS: Record<ProviderStatus, readonly ProviderStatus[]> = {
  shortlisted: ["requested", "quoted", "confirmed", "cancelled"],
  requested: ["quoted", "confirmed", "declined", "cancelled"],
  quoted: ["confirmed", "declined", "cancelled"],
  confirmed: ["cancelled"],
  declined: ["requested", "cancelled"],
  cancelled: ["shortlisted"],
};

export function canTransitionProvider(from: ProviderStatus, to: ProviderStatus): boolean {
  return PROVIDER_TRANSITIONS[from].includes(to);
}

/** Roles an organiser may assign through an invitation (owner is only reachable by transfer). */
export const ASSIGNABLE_ROLES = ["provider", "collaborator", "staff", "wedding_planner", "co_organizer", "lead_organizer"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
