/**
 * Pure token evaluation. The row shape mirrors invitation_tokens; the service
 * fetches by hash and calls this to decide the outcome without touching IO.
 */
export type TokenPurpose = "rsvp" | "checkin" | "provider_join";

export type TokenRowLike = {
  purpose: TokenPurpose;
  expiresAt: Date | null;
  revokedAt: Date | null;
  maxUses: number;
  useCount: number;
  eventId: string;
  invitationStatus: "draft" | "sent" | "viewed" | "answered" | "revoked" | "expired";
};

export type TokenOutcome = "valid" | "expired" | "revoked" | "duplicate" | "invalid";

export function evaluateToken(row: TokenRowLike | null | undefined, expected: { purpose: TokenPurpose; eventId?: string; now?: Date }): TokenOutcome {
  if (!row) return "invalid";
  if (row.purpose !== expected.purpose) return "invalid";
  // Isolation: a token from event A never validates in event B.
  if (expected.eventId && row.eventId !== expected.eventId) return "invalid";
  const now = expected.now ?? new Date();
  if (row.revokedAt || row.invitationStatus === "revoked") return "revoked";
  if (row.invitationStatus === "expired") return "expired";
  if (row.expiresAt && row.expiresAt.getTime() < now.getTime()) return "expired";
  if (row.useCount >= row.maxUses) return "duplicate";
  return "valid";
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Extracts the opaque token from what a scanner or a human typed: the raw
 * token, or the check-in URL (`${APP_URL}/c/<token>`). Never contains personal data.
 */
export function parseCheckinCode(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (TOKEN_RE.test(v)) return v;
  try {
    const url = new URL(v);
    const last = url.pathname.split("/").filter(Boolean).pop() ?? "";
    return TOKEN_RE.test(last) ? last : null;
  } catch {
    const last = v.split("/").filter(Boolean).pop() ?? "";
    return TOKEN_RE.test(last) ? last : null;
  }
}

export function checkinUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/c/${token}`;
}

export function rsvpUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/invitation/${token}`;
}

export const CHECKIN_RESULT_LABELS: Record<"accepted" | "duplicate" | "revoked" | "expired" | "invalid", string> = {
  accepted: "Invitation valide — vérifiez l'identité si nécessaire",
  duplicate: "Déjà utilisée — ce code a déjà été validé",
  revoked: "Invitation révoquée",
  expired: "Invitation expirée",
  invalid: "Code inconnu pour cet évènement",
};
