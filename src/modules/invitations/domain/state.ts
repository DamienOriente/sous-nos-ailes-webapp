/**
 * Invitation lifecycle (pure). draft → sent → viewed → answered; revoked and
 * expired are terminal. An answered invitation can still be revoked (to
 * invalidate its QR code) but never goes back to sent.
 */
export const INVITATION_STATUSES = ["draft", "sent", "viewed", "answered", "revoked", "expired"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  viewed: "Consultée",
  answered: "Répondue",
  revoked: "Révoquée",
  expired: "Expirée",
};

export const INVITATION_STATUS_TONES: Record<InvitationStatus, "neutral" | "info" | "primary" | "success" | "danger" | "warning"> = {
  draft: "neutral",
  sent: "info",
  viewed: "primary",
  answered: "success",
  revoked: "danger",
  expired: "warning",
};

export const INVITATION_KINDS = ["individual", "family", "group"] as const;
export type InvitationKind = (typeof INVITATION_KINDS)[number];
export const INVITATION_KIND_LABELS: Record<InvitationKind, string> = { individual: "Individuelle", family: "Familiale", group: "De groupe" };

const TRANSITIONS: Record<InvitationStatus, readonly InvitationStatus[]> = {
  // A draft's RSVP link can be shared by hand (no e-mail), so it may be viewed/answered directly.
  draft: ["sent", "viewed", "answered", "revoked", "expired"],
  sent: ["viewed", "answered", "revoked", "expired"],
  viewed: ["answered", "revoked", "expired"],
  answered: ["revoked", "expired"],
  revoked: [],
  expired: [],
};

export function canTransition(from: InvitationStatus, to: InvitationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: InvitationStatus): boolean {
  return status === "revoked" || status === "expired";
}

/** Status after the recipient opened the link: only forward moves. */
export function statusAfterView(current: InvitationStatus): InvitationStatus {
  return canTransition(current, "viewed") ? "viewed" : current;
}

export function statusAfterAnswer(current: InvitationStatus): InvitationStatus {
  if (current === "answered") return current;
  return canTransition(current, "answered") ? "answered" : current;
}

/** Whether the public RSVP form accepts a submission for this invitation. */
export function acceptsResponse(status: InvitationStatus): boolean {
  return status === "sent" || status === "viewed" || status === "answered" || status === "draft";
}

export const RSVP_EXPIRY_GRACE_DAYS = 7;

/** RSVP links stay valid until 7 days after the event (or 1 year without a date). */
export function computeRsvpExpiry(eventDate: string | null, now = new Date()): Date {
  if (eventDate) {
    const d = new Date(`${eventDate}T23:59:59.000Z`);
    if (!Number.isNaN(d.getTime())) return new Date(d.getTime() + RSVP_EXPIRY_GRACE_DAYS * 86_400_000);
  }
  return new Date(now.getTime() + 365 * 86_400_000);
}
