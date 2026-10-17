// French labels for enumerations. Kept in one place so UI and emails agree.
import type {
  AssignmentStatus,
  ApplicationStatus,
  EditorialStatus,
  EventStatus,
  EventType,
  InvitationStatus,
  PartnershipStatus,
  ProviderVettingStatus,
  QualificationStatus,
  QuoteVersionStatus,
  TriState,
  VenueType,
} from "@/generated/prisma/enums";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  WEDDING: "Mariage",
  PRIVATE_PARTY: "Fête privée",
  PROFESSIONAL: "Événement professionnel",
  OTHER: "Autre événement",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  NEW: "Nouvelle demande",
  QUALIFYING: "À qualifier",
  PROPOSAL_SENT: "Proposition envoyée",
  AGREED: "Accord de principe",
  PREPARING: "Préparation",
  CONFIRMED: "Confirmée",
  COMPLETED: "Réalisée",
  DECLINED: "Refusée",
  CANCELLED: "Annulée",
};

export const TRI_STATE_LABELS: Record<TriState, string> = {
  YES: "Oui",
  PARTIAL: "En partie",
  NO: "Non",
  UNKNOWN: "À préciser",
};

export const QUOTE_STATUS_LABELS: Record<QuoteVersionStatus, string> = {
  DRAFT: "Brouillon",
  SENT: "Transmise",
  ACCEPTED: "Accord de principe donné",
  SUPERSEDED: "Remplacée",
  WITHDRAWN: "Retirée",
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: "En attente de réponse",
  ACCEPTED: "Disponible (acceptée)",
  DECLINED: "Refusée",
  WITHDRAWN: "Retirée",
  EXPIRED: "Expirée",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  ASSIGNED: "Affectée",
  CANCELLED: "Annulée",
};

export const VETTING_STATUS_LABELS: Record<ProviderVettingStatus, string> = {
  NEW: "Nouveau profil",
  IN_REVIEW: "Vérification en cours",
  ACTIVE: "Vérifié manuellement, actif",
  PAUSED: "En pause",
};

export const QUALIFICATION_STATUS_LABELS: Record<QualificationStatus, string> = {
  DECLARED: "Déclarée",
  VERIFIED: "Vérifiée par Marie",
  REJECTED: "Non retenue",
};

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  CHATEAU: "Château",
  DOMAINE: "Domaine",
  SALLE_DE_RECEPTION: "Salle de réception",
  RESTAURANT: "Restaurant",
  HOTEL: "Hôtel",
  AUTRE: "Autre lieu",
};

export const PARTNERSHIP_STATUS_LABELS: Record<PartnershipStatus, string> = {
  PROSPECT: "Contact en cours",
  ACTIVE: "Partenariat actif",
  PAUSED: "En pause",
  ENDED: "Terminé",
};

export const EDITORIAL_STATUS_LABELS: Record<EditorialStatus, string> = {
  DRAFT: "Brouillon",
  REVIEW: "À valider",
  PUBLISHED: "Publiée",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  NEW: "Nouvelle",
  REVIEWING: "En cours d’étude",
  ACCEPTED: "Retenue",
  DECLINED: "Non retenue",
};

export const AGE_GROUP_LABELS = {
  childrenUnder3: "Moins de 3 ans",
  children3to5: "3 à 5 ans",
  children6to10: "6 à 10 ans",
  children11plus: "11 ans et plus",
} as const;

export type AgeGroupKey = keyof typeof AGE_GROUP_LABELS;
export const AGE_GROUP_KEYS = Object.keys(AGE_GROUP_LABELS) as AgeGroupKey[];

export type HeadcountByAge = Record<AgeGroupKey, number>;

export function totalChildren(headcount: HeadcountByAge): number {
  return AGE_GROUP_KEYS.reduce((sum, key) => sum + (headcount[key] ?? 0), 0);
}

export function formatHeadcount(headcount: HeadcountByAge): string {
  const parts = AGE_GROUP_KEYS.filter((key) => headcount[key] > 0).map(
    (key) => `${headcount[key]} (${AGE_GROUP_LABELS[key].toLowerCase()})`,
  );
  return parts.length ? parts.join(", ") : "Effectifs à préciser";
}

/** French wording for audit trail actions (keys are the `AuditEvent.action` values). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "request.submitted": "Demande reçue",
  "auth.login.password": "Connexion par mot de passe",
  "auth.magic-link.sent": "Lien de connexion envoyé",
  "event.status.qualifying": "Dossier passé à qualifier",
  "event.status.proposal_sent": "Proposition transmise",
  "event.status.agreed": "Accord de principe enregistré",
  "event.status.preparing": "Dossier en préparation",
  "event.status.confirmed": "Prestation confirmée",
  "event.status.completed": "Prestation réalisée",
  "event.status.declined": "Demande refusée",
  "event.status.cancelled": "Dossier annulé",
  "event.updated": "Fiche événement modifiée",
  "event.preparation.answered": "Réponses de préparation du client",
  "event.ops.validated": "Points opérationnels validés",
  "event.ops.unvalidated": "Validation opérationnelle retirée",
  "quote.draft.created": "Brouillon de proposition créé",
  "quote.draft.updated": "Brouillon de proposition modifié",
  "quote.draft.deleted": "Brouillon de proposition supprimé",
  "quote.sent": "Proposition transmise au client",
  "quote.accepted": "Accord de principe du client",
  "invitation.sent": "Mission proposée",
  "invitation.accepted": "Proposition acceptée par l’intervenant·e",
  "invitation.declined": "Proposition refusée par l’intervenant·e",
  "invitation.withdrawn": "Proposition retirée",
  "assignment.created": "Intervenant·e affecté·e",
  "assignment.cancelled": "Affectation annulée",
  "provider.created": "Profil intervenant·e créé",
  "provider.updated": "Profil intervenant·e modifié",
  "provider.vetting": "Vérification du profil mise à jour",
  "provider.qualification.declared": "Qualification déclarée",
  "provider.qualification.status": "Statut d’une qualification modifié",
  "provider.availability.added": "Disponibilité ajoutée",
  "provider.unavailability.added": "Indisponibilité ajoutée",
  "venue.created": "Lieu créé",
  "venue.updated": "Lieu modifié",
  "venue.editorial.draft": "Page de lieu repassée en brouillon",
  "venue.editorial.review": "Page de lieu envoyée en validation",
  "venue.editorial.published": "Page de lieu publiée",
  "venue.verified": "Informations du lieu vérifiées",
  "venue.partner-user.linked": "Compte partenaire rattaché",
  "note.added": "Note interne ajoutée",
  "note.deleted": "Note interne supprimée",
  "application.status": "Candidature traitée",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
