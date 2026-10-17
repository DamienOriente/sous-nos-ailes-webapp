/**
 * Pure childcare rules — zero IO. Everything here is unit-tested and reused by
 * the application services, which add the database and the authorization
 * checks around it.
 */
import type { EventAccess } from "@/modules/authorization";

export type ChildSummary = {
  id: string;
  firstName: string;
  lastName: string;
  ageYears: number;
  anonymizedAt: Date | null;
};

/**
 * Children visible to an actor: organisers see the whole roster; childcare
 * providers/staff only see the children assigned to them. `assignedChildIds`
 * is the set of children assigned to `access.memberId`.
 */
export function filterVisibleChildren<T extends { id: string }>(children: readonly T[], access: Pick<EventAccess, "childScopeIsAssignmentOnly">, assignedChildIds: ReadonlySet<string>): T[] {
  if (!access.childScopeIsAssignmentOnly) return [...children];
  return children.filter((c) => assignedChildIds.has(c.id));
}

export type ConsentState = { consentGivenAt: Date | null; consentWithdrawnAt: Date | null };

/** Consent for health data is active only when given and not withdrawn. */
export function hasActiveConsent(state: ConsentState | null | undefined): boolean {
  return Boolean(state?.consentGivenAt) && !state?.consentWithdrawnAt;
}

export type SensitiveReadDecision = { allowed: true } | { allowed: false; reason: "no_permission" | "not_assigned" | "no_consent" | "missing_purpose" };

/**
 * Reading health data requires: the permission, the assignment (for scoped
 * members), an active consent and a stated purpose (which is logged).
 */
export function decideSensitiveRead(input: { hasPermission: boolean; scopeIsAssignmentOnly: boolean; isAssigned: boolean; consent: ConsentState | null; purpose: string }): SensitiveReadDecision {
  if (!input.hasPermission) return { allowed: false, reason: "no_permission" };
  if (input.scopeIsAssignmentOnly && !input.isAssigned) return { allowed: false, reason: "not_assigned" };
  if (!hasActiveConsent(input.consent)) return { allowed: false, reason: "no_consent" };
  if (input.purpose.trim().length < 3) return { allowed: false, reason: "missing_purpose" };
  return { allowed: true };
}

export const IDENTITY_CHECK_METHODS = ["id_document", "known_person", "guardian_phone_confirmation", "other"] as const;
export type IdentityCheckMethod = (typeof IDENTITY_CHECK_METHODS)[number];

export const IDENTITY_CHECK_LABELS: Record<IdentityCheckMethod, string> = {
  id_document: "Pièce d'identité présentée",
  known_person: "Personne connue de l'équipe / du responsable",
  guardian_phone_confirmation: "Confirmation téléphonique du responsable légal",
  other: "Autre (préciser)",
};

export type HandoverInput = {
  authorizedPersonId: string | null;
  identityCheckMethod: string;
  identityCheckDetails: string;
  confirmerHasPermission: boolean;
  confirmerIsAssignedOrOrganizer: boolean;
};

export type HandoverValidation = { ok: true; identityVerifiedHow: string } | { ok: false; error: string };

/**
 * A handover is valid only if: an authorised person was selected from the
 * list (no free-text "other person"), the identity check is declared, and
 * the confirming staff member is allowed to hand over this child. A QR code
 * never replaces these steps.
 */
export function validateHandover(input: HandoverInput): HandoverValidation {
  if (!input.confirmerHasPermission) return { ok: false, error: "Vous n'êtes pas habilité à confirmer une remise." };
  if (!input.confirmerIsAssignedOrOrganizer) return { ok: false, error: "Cet enfant ne vous est pas affecté." };
  if (!input.authorizedPersonId) return { ok: false, error: "Choisissez une personne autorisée. Une personne absente de la liste doit d'abord être ajoutée par un organisateur." };
  if (!(IDENTITY_CHECK_METHODS as readonly string[]).includes(input.identityCheckMethod)) return { ok: false, error: "Indiquez comment l'identité a été vérifiée." };
  const details = input.identityCheckDetails.trim();
  if (input.identityCheckMethod === "other" && details.length < 3) return { ok: false, error: "Précisez la méthode de vérification." };
  const label = IDENTITY_CHECK_LABELS[input.identityCheckMethod as IdentityCheckMethod];
  return { ok: true, identityVerifiedHow: details ? `${label} — ${details}` : label };
}

export type AttendanceEvent = { childId: string; kind: "check_in" | "check_out" | "incident" | "note"; recordedAt: Date };
export type PresenceStatus = "expected" | "present" | "left";

/** Latest check_in/check_out per child decides the presence status. */
export function computePresence(childIds: readonly string[], attendance: readonly AttendanceEvent[]): Map<string, PresenceStatus> {
  const result = new Map<string, PresenceStatus>();
  for (const id of childIds) result.set(id, "expected");
  const sorted = [...attendance].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  for (const a of sorted) {
    if (!result.has(a.childId)) continue;
    if (a.kind === "check_in") result.set(a.childId, "present");
    else if (a.kind === "check_out") result.set(a.childId, "left");
  }
  return result;
}

export function summarizePresence(presence: ReadonlyMap<string, PresenceStatus>): { expected: number; present: number; left: number } {
  let expected = 0;
  let present = 0;
  let left = 0;
  for (const s of presence.values()) {
    if (s === "expected") expected++;
    else if (s === "present") present++;
    else left++;
  }
  return { expected, present, left };
}

/**
 * Anonymous dietary aggregate for the caterer. Input rows carry only the
 * preference label; the output never contains a name. Empty/blank preferences
 * are counted under "standard".
 */
export function aggregateDietary(rows: ReadonlyArray<{ preference: string | null; isChild: boolean }>): { label: string; adults: number; children: number; total: number }[] {
  const map = new Map<string, { adults: number; children: number }>();
  for (const r of rows) {
    const label = normalizeDietaryLabel(r.preference);
    const cur = map.get(label) ?? { adults: 0, children: 0 };
    if (r.isChild) cur.children++;
    else cur.adults++;
    map.set(label, cur);
  }
  return [...map.entries()]
    .map(([label, v]) => ({ label, adults: v.adults, children: v.children, total: v.adults + v.children }))
    .sort((a, b) => (a.label === "standard" ? -1 : b.label === "standard" ? 1 : b.total - a.total || a.label.localeCompare(b.label)));
}

export function normalizeDietaryLabel(pref: string | null | undefined): string {
  const v = (pref ?? "").trim().toLowerCase();
  return v.length ? v : "standard";
}

/** Text the organiser can copy to inform the legal guardian (GDPR art. 13). */
export const GUARDIAN_INFORMATION_TEXT = `Bonjour,

Dans le cadre de l'évènement, les informations concernant votre enfant (prénom, âge, vos coordonnées, consignes pratiques et, si vous l'avez accepté, les informations de santé utiles à sa garde) sont enregistrées sur la plateforme Sous Nos Ailes par l'organisateur, uniquement pour assurer sa prise en charge le jour J.

Ces informations sont visibles de l'organisateur et de l'équipe de garde affectée à votre enfant. Les informations de santé sont chiffrées, consultables uniquement avec votre accord explicite et chaque consultation est enregistrée. Elles sont supprimées ou rendues anonymes après l'évènement.

Vous pouvez à tout moment demander la modification ou la suppression de ces informations, ou retirer votre accord, en contactant l'organisateur.`;

/** What gets erased when a guardian withdraws consent or when retention kicks in. */
export const ANONYMIZED_PLACEHOLDER = "—";
