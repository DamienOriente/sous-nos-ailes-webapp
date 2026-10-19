/** Mirrors StatusTone of the shared StatusBadge without importing presentation code into the domain. */
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

export const PROFESSIONAL_STATUSES = ["draft", "pending_review", "changes_requested", "approved", "published", "suspended", "rejected", "archived"] as const;
export type ProfessionalStatus = (typeof PROFESSIONAL_STATUSES)[number];

/**
 * State machine of a listing. `owner` transitions are triggered by the
 * professional, `moderator` ones by staff with "moderation.decide".
 */
const OWNER_TRANSITIONS: Record<ProfessionalStatus, readonly ProfessionalStatus[]> = {
  draft: ["pending_review", "archived"],
  pending_review: ["draft", "archived"],
  changes_requested: ["pending_review", "archived"],
  approved: ["archived"],
  published: ["archived"],
  suspended: ["archived"],
  rejected: ["pending_review", "archived"],
  archived: [],
};

const MODERATOR_TRANSITIONS: Record<ProfessionalStatus, readonly ProfessionalStatus[]> = {
  draft: [],
  pending_review: ["approved", "published", "changes_requested", "rejected"],
  changes_requested: ["approved", "published", "rejected"],
  approved: ["published", "suspended", "rejected"],
  published: ["suspended", "changes_requested"],
  suspended: ["published", "rejected", "archived"],
  rejected: ["pending_review"],
  archived: [],
};

export type TransitionActor = "owner" | "moderator";

export function canTransition(from: ProfessionalStatus, to: ProfessionalStatus, actor: TransitionActor): boolean {
  const table = actor === "owner" ? OWNER_TRANSITIONS : MODERATOR_TRANSITIONS;
  return table[from].includes(to);
}

export const STATUS_LABELS: Record<ProfessionalStatus, string> = {
  draft: "Brouillon",
  pending_review: "En attente de validation",
  changes_requested: "Modifications demandées",
  approved: "Approuvée",
  published: "Publiée",
  suspended: "Suspendue",
  rejected: "Refusée",
  archived: "Archivée",
};

export const STATUS_TONES: Record<ProfessionalStatus, StatusTone> = {
  draft: "neutral",
  pending_review: "info",
  changes_requested: "warning",
  approved: "success",
  published: "success",
  suspended: "danger",
  rejected: "danger",
  archived: "neutral",
};

/** Plain-language explanation + what the professional should do next. */
export function describeStatus(status: ProfessionalStatus, reason?: string | null): { explanation: string; nextStep: string } {
  switch (status) {
    case "draft":
      return { explanation: "Votre fiche n'est visible que par vous.", nextStep: "Complétez les informations puis soumettez la fiche à la validation." };
    case "pending_review":
      return { explanation: "Notre équipe relit votre fiche. Ce contrôle prend en général moins de 48 h ouvrées.", nextStep: "Vous pouvez compléter vos prestations et disponibilités en attendant." };
    case "changes_requested":
      return { explanation: reason ? `L'équipe demande des ajustements : ${reason}` : "L'équipe demande des ajustements avant publication.", nextStep: "Modifiez les éléments concernés puis soumettez de nouveau la fiche." };
    case "approved":
      return { explanation: "Votre fiche a été validée et sera publiée très prochainement.", nextStep: "Préparez votre page publique et vos prestations." };
    case "published":
      return { explanation: "Votre fiche est visible dans l'annuaire et peut recevoir des demandes.", nextStep: "Gardez vos disponibilités à jour et répondez rapidement aux demandes." };
    case "suspended":
      return { explanation: reason ? `Votre fiche est temporairement retirée de l'annuaire : ${reason}` : "Votre fiche est temporairement retirée de l'annuaire.", nextStep: "Contactez l'équipe de modération pour lever la suspension." };
    case "rejected":
      return { explanation: reason ? `Votre fiche n'a pas été acceptée : ${reason}` : "Votre fiche n'a pas été acceptée.", nextStep: "Corrigez les points signalés puis soumettez-la de nouveau, ou contactez l'équipe." };
    case "archived":
      return { explanation: "Cette fiche est archivée et n'apparaît plus nulle part.", nextStep: "Créez une nouvelle fiche si vous souhaitez revenir dans l'annuaire." };
  }
}

/** Fields whose change on a published listing triggers a new moderation review. */
export const MAJOR_FIELDS = ["displayName", "primaryCategoryId", "description", "tagline"] as const;
export type MajorField = (typeof MAJOR_FIELDS)[number];

export function changedMajorFields<T extends Partial<Record<MajorField, unknown>>>(before: T, after: T): MajorField[] {
  return MAJOR_FIELDS.filter((f) => f in after && after[f] !== undefined && after[f] !== before[f]);
}
