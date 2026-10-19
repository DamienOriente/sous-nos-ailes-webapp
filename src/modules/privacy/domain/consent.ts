/**
 * Cookie consent model. Pure: parsing/serialising the consent cookie and the
 * category catalogue. The cookie only stores a random id and the choices, so it
 * can never be used to identify a person.
 */
export const CONSENT_COOKIE_NAME = "sna_consent";
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 182; // ~6 months, then we ask again
export const CONSENT_POLICY_VERSION = "2026-10";

export const CONSENT_CATEGORIES = [
  {
    key: "essential",
    label: "Strictement nécessaires",
    description: "Connexion, sécurité et mémorisation de votre choix. Toujours actifs.",
    required: true,
  },
  {
    key: "analytics",
    label: "Mesure d'audience",
    description: "Statistiques de fréquentation anonymes. Aucun outil n'est actif dans cette version : votre choix est enregistré pour l'avenir.",
    required: false,
  },
  {
    key: "marketing",
    label: "Marketing",
    description: "Publicité personnalisée et suivi inter-sites. Non utilisé par Sous Nos Ailes.",
    required: false,
  },
] as const;

export type ConsentCategoryKey = (typeof CONSENT_CATEGORIES)[number]["key"];

export type ConsentChoices = { analytics: boolean; marketing: boolean };

export type ConsentState = {
  /** Random UUID generated client-side or server-side at first choice. */
  anonymousId: string;
  version: string;
  choices: ConsentChoices;
  /** ISO timestamp of the decision. */
  decidedAt: string;
};

export const CONSENT_PURPOSES: Record<keyof ConsentChoices, string> = {
  analytics: "cookies_analytics",
  marketing: "cookies_marketing",
};

export function serializeConsent(state: ConsentState): string {
  return JSON.stringify({ id: state.anonymousId, v: state.version, a: state.choices.analytics ? 1 : 0, m: state.choices.marketing ? 1 : 0, t: state.decidedAt });
}

export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (typeof o.id !== "string" || !/^[0-9a-f-]{36}$/i.test(o.id)) return null;
    if (typeof o.v !== "string" || typeof o.t !== "string") return null;
    return {
      anonymousId: o.id,
      version: o.v,
      choices: { analytics: o.a === 1, marketing: o.m === 1 },
      decidedAt: o.t,
    };
  } catch {
    return null;
  }
}

/** A stored choice is only valid for the current policy version and the 6-month window. */
export function isConsentCurrent(state: ConsentState | null, now = new Date()): boolean {
  if (!state) return false;
  if (state.version !== CONSENT_POLICY_VERSION) return false;
  const decided = Date.parse(state.decidedAt);
  if (Number.isNaN(decided)) return false;
  return now.getTime() - decided < CONSENT_MAX_AGE_SECONDS * 1000;
}

export const ALL_REFUSED: ConsentChoices = { analytics: false, marketing: false };
export const ALL_ACCEPTED: ConsentChoices = { analytics: true, marketing: true };

/** Truncate the last octet / hextet: enough to detect abuse, not enough to identify. */
export function truncateIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return [...parts.slice(0, 4), "0", "0", "0", "0"].join(":");
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
}

