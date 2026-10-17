import type { GlobalRole } from "@/lib/session";

export const SECURITY_EVENT_TYPES = [
  "login_succeeded",
  "login_failed",
  "password_changed",
  "password_reset_requested",
  "password_reset_completed",
  "two_factor_enabled",
  "two_factor_disabled",
  "backup_codes_regenerated",
  "session_revoked",
  "sessions_revoked_all",
  "rate_limited",
] as const;
export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

export const SECURITY_EVENT_LABELS: Record<SecurityEventType, string> = {
  login_succeeded: "Connexion réussie",
  login_failed: "Tentative de connexion échouée",
  password_changed: "Mot de passe modifié",
  password_reset_requested: "Réinitialisation du mot de passe demandée",
  password_reset_completed: "Mot de passe réinitialisé",
  two_factor_enabled: "Double authentification activée",
  two_factor_disabled: "Double authentification désactivée",
  backup_codes_regenerated: "Codes de secours régénérés",
  session_revoked: "Session déconnectée",
  sessions_revoked_all: "Toutes les autres sessions déconnectées",
  rate_limited: "Limite de tentatives atteinte",
};

export const PRIVILEGED_ROLES: readonly GlobalRole[] = ["moderator", "admin", "super_admin"];

/** Platform roles for which 2FA is mandatory (enforced by the admin module, surfaced here as UX). */
export function isPrivilegedRole(role: GlobalRole): boolean {
  return PRIVILEGED_ROLES.includes(role);
}

/** Short, human description of a user agent for the sessions list (no fingerprinting intent). */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Appareil inconnu";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navigateur";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

export type SessionView = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
};

export type RawSession = { id: string; createdAt: Date; updatedAt: Date; expiresAt: Date; ipAddress?: string | null; userAgent?: string | null };

/** Strips tokens, drops expired entries, most recent activity first, current session flagged. */
export function toSessionViews(raw: RawSession[], currentSessionId: string, now = Date.now()): SessionView[] {
  return raw
    .filter((s) => new Date(s.expiresAt).getTime() > now)
    .map((s) => ({
      id: s.id,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
      expiresAt: new Date(s.expiresAt),
      ipAddress: s.ipAddress ?? null,
      userAgent: s.userAgent ?? null,
      isCurrent: s.id === currentSessionId,
    }))
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.updatedAt.getTime() - a.updatedAt.getTime());
}
