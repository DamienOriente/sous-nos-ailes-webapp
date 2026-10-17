/**
 * Verification vocabulary. Every label states exactly what was checked; the
 * platform never claims a "certification" or an official approval.
 */
export const VERIFICATION_KINDS = [
  "identity_declared",
  "business_registration_checked",
  "documents_reviewed",
  "insurance_declared",
  "insurance_verified",
  "qualification_declared",
  "qualification_verified",
  "administrative_check_done",
] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];
export type VerificationStatus = "pending" | "verified" | "rejected" | "expired";

export type VerificationRow = { kind: VerificationKind; status: VerificationStatus; validUntil?: Date | null };

export const VERIFICATION_KIND_LABELS: Record<VerificationKind, { label: string; meaning: string; documentKind: DocumentKind | null }> = {
  identity_declared: {
    label: "Identité renseignée",
    meaning: "Le professionnel a renseigné son identité et ses coordonnées. Aucune pièce d'identité n'est contrôlée par la plateforme.",
    documentKind: null,
  },
  business_registration_checked: {
    label: "Informations professionnelles contrôlées",
    meaning: "Le numéro SIREN/SIRET déclaré a été rapproché d'un extrait d'immatriculation (Kbis, avis de situation SIRENE) par l'équipe.",
    documentKind: "kbis_or_sirene",
  },
  documents_reviewed: {
    label: "Justificatifs examinés",
    meaning: "Les justificatifs transmis ont été lus par un modérateur. Cet examen ne vaut pas garantie de la qualité de la prestation.",
    documentKind: "other_supporting",
  },
  insurance_declared: {
    label: "Assurance déclarée",
    meaning: "Le professionnel déclare détenir une assurance responsabilité civile professionnelle. L'attestation n'a pas encore été examinée.",
    documentKind: "insurance_certificate",
  },
  insurance_verified: {
    label: "Assurance vérifiée",
    meaning: "Une attestation d'assurance RC professionnelle en cours de validité a été examinée par l'équipe à la date indiquée.",
    documentKind: "insurance_certificate",
  },
  qualification_declared: {
    label: "Qualifications déclarées",
    meaning: "Le professionnel déclare des diplômes ou formations (ex. CAP AEPE, PSC1). Déclaratif, non contrôlé.",
    documentKind: "qualification",
  },
  qualification_verified: {
    label: "Qualifications vérifiées",
    meaning: "Les diplômes ou attestations de formation transmis ont été examinés par l'équipe.",
    documentKind: "qualification",
  },
  administrative_check_done: {
    label: "Contrôle administratif effectué",
    meaning: "L'équipe a réalisé un contrôle de cohérence des informations administratives (identité, immatriculation, coordonnées).",
    documentKind: null,
  },
};

export type DocumentKind = "kbis_or_sirene" | "insurance_certificate" | "qualification" | "other_supporting";

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  kbis_or_sirene: "Extrait Kbis ou avis de situation SIRENE",
  insurance_certificate: "Attestation d'assurance RC professionnelle",
  qualification: "Diplôme ou attestation de formation",
  other_supporting: "Autre justificatif",
};

/**
 * Public level derived from verified rows (0..5). The level is a summary; the
 * badge always exposes the underlying statements so nobody reads more into it.
 *  1 — identity declared
 *  2 — business registration checked
 *  3 — documents reviewed
 *  4 — insurance verified (or declared → stays at 3)
 *  5 — qualification verified in addition to insurance verified
 */
export function computeVerificationLevel(rows: readonly VerificationRow[], now: Date = new Date()): number {
  const active = new Set(rows.filter((r) => r.status === "verified" && (!r.validUntil || r.validUntil > now)).map((r) => r.kind));
  let level = 0;
  if (active.has("identity_declared")) level = 1;
  if (level >= 1 && (active.has("business_registration_checked") || active.has("administrative_check_done"))) level = 2;
  if (level >= 2 && active.has("documents_reviewed")) level = 3;
  if (level >= 3 && active.has("insurance_verified")) level = 4;
  if (level >= 4 && active.has("qualification_verified")) level = 5;
  return level;
}

export const VERIFICATION_LEVEL_LABELS: Record<number, string> = {
  0: "Non vérifié",
  1: "Identité renseignée",
  2: "Informations professionnelles contrôlées",
  3: "Justificatifs examinés",
  4: "Assurance vérifiée",
  5: "Assurance et qualifications vérifiées",
};

export function verificationLevelLabel(level: number): string {
  return VERIFICATION_LEVEL_LABELS[Math.max(0, Math.min(5, level))] ?? VERIFICATION_LEVEL_LABELS[0]!;
}

/** Statements shown in the badge tooltip: only verified rows, in a fixed order. */
export function verifiedStatements(rows: readonly VerificationRow[], now: Date = new Date()): string[] {
  return VERIFICATION_KINDS.filter((k) => rows.some((r) => r.kind === k && r.status === "verified" && (!r.validUntil || r.validUntil > now))).map((k) => VERIFICATION_KIND_LABELS[k].label);
}
