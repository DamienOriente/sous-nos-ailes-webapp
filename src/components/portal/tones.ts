import type { EditorialStatus, EventStatus, InvitationStatus, PartnershipStatus, QualificationStatus, QuoteVersionStatus } from "@/generated/prisma/enums";
import type { ClientStage } from "@/domain/workflow";
import type { Tone } from "@/components/ui/status-badge";

// Badge tones for the portals. Colour only accompanies the text label.

export const CLIENT_STAGE_TONES: Record<ClientStage, Tone> = {
  RECEIVED: "neutral",
  PROPOSAL: "info",
  TEAM: "clay",
  CONFIRMED: "sage",
  COMPLETED: "sage",
  CLOSED: "neutral",
};

export const QUOTE_STATUS_TONES: Record<QuoteVersionStatus, Tone> = {
  DRAFT: "neutral",
  SENT: "info",
  ACCEPTED: "sage",
  SUPERSEDED: "neutral",
  WITHDRAWN: "neutral",
};

export const INVITATION_STATUS_TONES: Record<InvitationStatus, Tone> = {
  PENDING: "info",
  ACCEPTED: "sage",
  DECLINED: "neutral",
  WITHDRAWN: "neutral",
  EXPIRED: "warning",
};

export const EVENT_STATUS_TONES: Record<EventStatus, Tone> = {
  NEW: "neutral",
  QUALIFYING: "neutral",
  PROPOSAL_SENT: "info",
  AGREED: "clay",
  PREPARING: "clay",
  CONFIRMED: "sage",
  COMPLETED: "sage",
  DECLINED: "neutral",
  CANCELLED: "danger",
};

export const QUALIFICATION_STATUS_TONES: Record<QualificationStatus, Tone> = {
  DECLARED: "neutral",
  VERIFIED: "sage",
  REJECTED: "warning",
};

export const EDITORIAL_STATUS_TONES: Record<EditorialStatus, Tone> = {
  DRAFT: "neutral",
  REVIEW: "info",
  PUBLISHED: "sage",
};

export const PARTNERSHIP_STATUS_TONES: Record<PartnershipStatus, Tone> = {
  PROSPECT: "neutral",
  ACTIVE: "sage",
  PAUSED: "warning",
  ENDED: "neutral",
};
