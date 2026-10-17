import type { EventStatus } from "@/generated/prisma/enums";

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

/** Allowed commercial transitions. Keys are current statuses. */
export const EVENT_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  NEW: ["QUALIFYING", "DECLINED", "CANCELLED"],
  QUALIFYING: ["PROPOSAL_SENT", "DECLINED", "CANCELLED"],
  PROPOSAL_SENT: ["AGREED", "QUALIFYING", "DECLINED", "CANCELLED"],
  AGREED: ["PREPARING", "PROPOSAL_SENT", "CANCELLED"],
  PREPARING: ["CONFIRMED", "PROPOSAL_SENT", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "PREPARING", "CANCELLED"],
  COMPLETED: [],
  DECLINED: ["QUALIFYING"],
  CANCELLED: [],
};

/** Transitions Marie may trigger by hand; the others are driven by quotes/acceptances. */
export const MANUAL_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  NEW: ["QUALIFYING", "DECLINED", "CANCELLED"],
  QUALIFYING: ["DECLINED", "CANCELLED"],
  PROPOSAL_SENT: ["QUALIFYING", "DECLINED", "CANCELLED"],
  AGREED: ["PREPARING", "CANCELLED"],
  PREPARING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "PREPARING", "CANCELLED"],
  COMPLETED: [],
  DECLINED: ["QUALIFYING"],
  CANCELLED: [],
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return EVENT_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransition(from, to)) {
    throw new WorkflowError(`Transition non autorisée : ${from} → ${to}`);
  }
}

export const TERMINAL_STATUSES: readonly EventStatus[] = ["COMPLETED", "CANCELLED"];
export const ACTIVE_STATUSES: readonly EventStatus[] = [
  "NEW",
  "QUALIFYING",
  "PROPOSAL_SENT",
  "AGREED",
  "PREPARING",
  "CONFIRMED",
];

export function isActiveStatus(status: EventStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Team-building state, deliberately separate from the commercial status. */
export type TeamStatus = "NOT_STARTED" | "INVITING" | "PARTIAL" | "COMPLETE";

export function computeTeamStatus(input: {
  requiredProviders: number;
  assignedCount: number;
  pendingInvitations: number;
  acceptedInvitationsNotAssigned: number;
}): TeamStatus {
  if (input.assignedCount >= input.requiredProviders && input.requiredProviders > 0) return "COMPLETE";
  if (input.assignedCount > 0) return "PARTIAL";
  if (input.pendingInvitations > 0 || input.acceptedInvitationsNotAssigned > 0) return "INVITING";
  return "NOT_STARTED";
}

export const TEAM_STATUS_LABELS: Record<TeamStatus, string> = {
  NOT_STARTED: "Équipe à constituer",
  INVITING: "Propositions en cours",
  PARTIAL: "Équipe incomplète",
  COMPLETE: "Équipe complète",
};

export type ConfirmationInput = {
  status: EventStatus;
  hasAcceptedCurrentQuote: boolean;
  teamStatus: TeamStatus;
  hasBlockingConflict: boolean;
  opsValidated: boolean;
  hasFixedDate: boolean;
};

export type ConfirmationCheck = { ok: boolean; blockers: string[] };

/** Explicit, human-readable blockers before an event can be confirmed. */
export function checkConfirmation(input: ConfirmationInput): ConfirmationCheck {
  const blockers: string[] = [];
  if (!canTransition(input.status, "CONFIRMED")) {
    blockers.push("La confirmation n’est possible qu’après l’accord de principe et pendant la préparation.");
  }
  if (!input.hasFixedDate) blockers.push("La date et les horaires doivent être fixés.");
  if (!input.hasAcceptedCurrentQuote) blockers.push("La proposition courante doit avoir reçu l’accord de principe du client.");
  if (input.teamStatus !== "COMPLETE") blockers.push("L’équipe nécessaire doit être acceptée et affectée au complet.");
  if (input.hasBlockingConflict) blockers.push("Un conflit horaire bloquant subsiste dans l’équipe.");
  if (!input.opsValidated) blockers.push("Marie doit valider les points opérationnels (espace, rendez-vous, contact).");
  return { ok: blockers.length === 0, blockers };
}

/** Simplified stage shown to clients. */
export type ClientStage = "RECEIVED" | "PROPOSAL" | "TEAM" | "CONFIRMED" | "COMPLETED" | "CLOSED";

export function clientStageFor(status: EventStatus): ClientStage {
  switch (status) {
    case "NEW":
    case "QUALIFYING":
      return "RECEIVED";
    case "PROPOSAL_SENT":
      return "PROPOSAL";
    case "AGREED":
    case "PREPARING":
      return "TEAM";
    case "CONFIRMED":
      return "CONFIRMED";
    case "COMPLETED":
      return "COMPLETED";
    case "DECLINED":
    case "CANCELLED":
      return "CLOSED";
  }
}

export const CLIENT_STAGE_LABELS: Record<ClientStage, string> = {
  RECEIVED: "Demande reçue",
  PROPOSAL: "Proposition transmise",
  TEAM: "Équipe en cours de constitution",
  CONFIRMED: "Prestation confirmée",
  COMPLETED: "Prestation réalisée",
  CLOSED: "Dossier clos",
};
