/**
 * Product event catalogue. Names are closed (a typo cannot create a new
 * metric) and each name declares the only property keys it accepts, so free
 * text, e-mails or health data can never be tracked by accident.
 */
export const PRODUCT_EVENTS = {
  "user.signed_up": ["intent"],
  "event.created": ["eventType"],
  "professional.published": ["categorySlug"],
  "directory.searched": ["categorySlug", "hasCity", "resultsCount"],
  "inquiry.sent": ["kind", "categorySlug"],
  "invitation.sent": ["kind"],
  "tool.activated": ["toolKey"],
  "premium.viewed": ["audience", "feature"],
  "subscription.started": ["planKey", "provider"],
  "subscription.canceled": ["planKey"],
  "consent.updated": ["analytics", "marketing"],
  "report.submitted": ["resourceType", "reason"],
  "contact.sent": [],
} as const;

export type ProductEventName = keyof typeof PRODUCT_EVENTS;
export type ProductEventProps = Record<string, string | number | boolean | null>;

export const PRODUCT_EVENT_LABELS: Record<ProductEventName, string> = {
  "user.signed_up": "Inscriptions",
  "event.created": "Évènements créés",
  "professional.published": "Fiches publiées",
  "directory.searched": "Recherches",
  "inquiry.sent": "Demandes envoyées",
  "invitation.sent": "Invitations envoyées",
  "tool.activated": "Outils activés",
  "premium.viewed": "Vues d'une offre premium",
  "subscription.started": "Abonnements souscrits",
  "subscription.canceled": "Résiliations",
  "consent.updated": "Choix cookies",
  "report.submitted": "Signalements",
  "contact.sent": "Messages de contact",
};

export function isProductEventName(value: string): value is ProductEventName {
  return Object.hasOwn(PRODUCT_EVENTS, value);
}

const MAX_STRING = 64;

/** Keeps only declared keys with scalar values; strings are truncated so a property can never carry a paragraph. */
export function sanitizeProperties(name: ProductEventName, props: ProductEventProps | undefined): ProductEventProps {
  const allowed: readonly string[] = PRODUCT_EVENTS[name];
  const out: ProductEventProps = {};
  if (!props) return out;
  for (const key of allowed) {
    const v = props[key];
    if (v === undefined) continue;
    if (v === null || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) out[key] = v;
    else if (typeof v === "string") out[key] = v.slice(0, MAX_STRING);
  }
  return out;
}

export type TrackContext = {
  userId?: string | null;
  /** From the consent cookie; ignored when `analyticsConsent` is false. */
  anonymousId?: string | null;
  analyticsConsent?: boolean;
};

/**
 * Consent gate, pure: a logged-in user's event is internal analytics
 * (legitimate interest, minimised); an anonymous visitor's event needs consent.
 */
export function decideTracking(ctx: TrackContext): { track: false } | { track: true; userId: string | null; anonymousId: string | null } {
  if (ctx.userId) return { track: true, userId: ctx.userId, anonymousId: null };
  if (ctx.anonymousId && ctx.analyticsConsent === true) return { track: true, userId: null, anonymousId: ctx.anonymousId };
  return { track: false };
}
