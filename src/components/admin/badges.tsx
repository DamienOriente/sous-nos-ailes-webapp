import { StatusBadge, type Tone } from "@/components/ui/status-badge";
import {
  APPLICATION_STATUS_LABELS,
  EDITORIAL_STATUS_LABELS,
  EVENT_STATUS_LABELS,
  INVITATION_STATUS_LABELS,
  PARTNERSHIP_STATUS_LABELS,
  QUALIFICATION_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
  VETTING_STATUS_LABELS,
} from "@/domain/labels";
import { TEAM_STATUS_LABELS, type TeamStatus } from "@/domain/workflow";
import type {
  ApplicationStatus,
  AvailabilityKind,
  EditorialStatus,
  EventStatus,
  InvitationStatus,
  PartnershipStatus,
  ProviderVettingStatus,
  QualificationStatus,
  QuoteVersionStatus,
  RequestSource,
} from "@/generated/prisma/enums";

// Status is always carried by a dot plus text (StatusBadge); tones only reinforce it.

const EVENT_TONES: Record<EventStatus, Tone> = {
  NEW: "clay",
  QUALIFYING: "warning",
  PROPOSAL_SENT: "info",
  AGREED: "sage",
  PREPARING: "info",
  CONFIRMED: "sage",
  COMPLETED: "neutral",
  DECLINED: "neutral",
  CANCELLED: "danger",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <StatusBadge tone={EVENT_TONES[status]}>{EVENT_STATUS_LABELS[status]}</StatusBadge>;
}

// Mirrors teamStatusLabelTone() from the events service without pulling server code into the UI.
const TEAM_TONES: Record<TeamStatus, Tone> = { NOT_STARTED: "neutral", INVITING: "info", PARTIAL: "warning", COMPLETE: "sage" };

export function TeamStatusBadge({ status }: { status: TeamStatus }) {
  return <StatusBadge tone={TEAM_TONES[status]}>{TEAM_STATUS_LABELS[status]}</StatusBadge>;
}

const QUOTE_TONES: Record<QuoteVersionStatus, Tone> = { DRAFT: "neutral", SENT: "info", ACCEPTED: "sage", SUPERSEDED: "neutral", WITHDRAWN: "neutral" };

export function QuoteStatusBadge({ status }: { status: QuoteVersionStatus }) {
  return <StatusBadge tone={QUOTE_TONES[status]}>{QUOTE_STATUS_LABELS[status]}</StatusBadge>;
}

const INVITATION_TONES: Record<InvitationStatus, Tone> = { PENDING: "warning", ACCEPTED: "sage", DECLINED: "danger", WITHDRAWN: "neutral", EXPIRED: "neutral" };

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  return <StatusBadge tone={INVITATION_TONES[status]}>{INVITATION_STATUS_LABELS[status]}</StatusBadge>;
}

const VETTING_TONES: Record<ProviderVettingStatus, Tone> = { NEW: "clay", IN_REVIEW: "warning", ACTIVE: "sage", PAUSED: "neutral" };

export function VettingBadge({ status }: { status: ProviderVettingStatus }) {
  return <StatusBadge tone={VETTING_TONES[status]}>{VETTING_STATUS_LABELS[status]}</StatusBadge>;
}

const QUALIFICATION_TONES: Record<QualificationStatus, Tone> = { DECLARED: "neutral", VERIFIED: "sage", REJECTED: "danger" };

export function QualificationBadge({ status }: { status: QualificationStatus }) {
  return <StatusBadge tone={QUALIFICATION_TONES[status]}>{QUALIFICATION_STATUS_LABELS[status]}</StatusBadge>;
}

const EDITORIAL_TONES: Record<EditorialStatus, Tone> = { DRAFT: "neutral", REVIEW: "warning", PUBLISHED: "sage" };

export function EditorialBadge({ status }: { status: EditorialStatus }) {
  return <StatusBadge tone={EDITORIAL_TONES[status]}>{EDITORIAL_STATUS_LABELS[status]}</StatusBadge>;
}

const PARTNERSHIP_TONES: Record<PartnershipStatus, Tone> = { PROSPECT: "clay", ACTIVE: "sage", PAUSED: "warning", ENDED: "neutral" };

export function PartnershipBadge({ status }: { status: PartnershipStatus }) {
  return <StatusBadge tone={PARTNERSHIP_TONES[status]}>{PARTNERSHIP_STATUS_LABELS[status]}</StatusBadge>;
}

const APPLICATION_TONES: Record<ApplicationStatus, Tone> = { NEW: "clay", REVIEWING: "warning", ACCEPTED: "sage", DECLINED: "neutral" };

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <StatusBadge tone={APPLICATION_TONES[status]}>{APPLICATION_STATUS_LABELS[status]}</StatusBadge>;
}

export const AVAILABILITY_KIND_LABELS: Record<AvailabilityKind, string> = { AVAILABLE: "Disponible", UNAVAILABLE: "Indisponible" };

export function AvailabilityKindBadge({ kind }: { kind: AvailabilityKind }) {
  return <StatusBadge tone={kind === "AVAILABLE" ? "sage" : "danger"}>{AVAILABILITY_KIND_LABELS[kind]}</StatusBadge>;
}

export const REQUEST_SOURCE_LABELS: Record<RequestSource, string> = { DIRECT: "Site", PARTNER_LINK: "Lien partenaire", VENUE_PAGE: "Page lieu" };

export const COST_BASIS_LABELS = { PER_MISSION: "par mission", PER_HOUR: "par heure" } as const;

export const LINE_KIND_LABELS = {
  SERVICE: "Prestation",
  TRAVEL: "Déplacement",
  OPTION: "Option",
  SURCHARGE: "Majoration",
  DISCOUNT: "Remise",
  OTHER: "Autre",
} as const;

export const PRICING_UNIT_LABELS = { FLAT: "Forfait", PER_HOUR: "Par heure", PER_PROVIDER: "Par intervenant·e" } as const;
