import type { EventPermission } from "@/modules/authorization/domain/permissions";

/** French labels + grouping for the permissions editor. Keep in sync with the catalogue. */
export const PERMISSION_GROUPS: ReadonlyArray<{ title: string; permissions: ReadonlyArray<{ key: EventPermission; label: string; sensitive?: boolean }> }> = [
  {
    title: "Évènement",
    permissions: [
      { key: "event.view", label: "Voir l'évènement" },
      { key: "event.edit", label: "Modifier les informations de l'évènement" },
      { key: "event.delete", label: "Supprimer l'évènement" },
      { key: "event.inquiries.view", label: "Voir les demandes commerciales" },
    ],
  },
  {
    title: "Équipe",
    permissions: [
      { key: "event.members.view", label: "Voir les membres" },
      { key: "event.members.manage", label: "Inviter, changer le rôle ou révoquer des membres" },
      { key: "event.permissions.manage", label: "Gérer les permissions explicites" },
    ],
  },
  {
    title: "Organisation",
    permissions: [
      { key: "event.tasks.view", label: "Voir les tâches" },
      { key: "event.tasks.manage", label: "Créer et modifier les tâches" },
      { key: "event.milestones.view", label: "Voir le planning du jour J" },
      { key: "event.milestones.manage", label: "Modifier le planning du jour J" },
      { key: "event.budget.view", label: "Voir le budget" },
      { key: "event.budget.manage", label: "Modifier le budget et les dépenses" },
      { key: "event.documents.view", label: "Voir les documents partagés" },
      { key: "event.documents.manage", label: "Ajouter et supprimer des documents" },
      { key: "event.providers.view", label: "Voir les prestataires" },
      { key: "event.providers.manage", label: "Gérer les prestataires et les devis" },
    ],
  },
  {
    title: "Invités",
    permissions: [
      { key: "event.guests.view", label: "Voir la liste des invités" },
      { key: "event.guests.manage", label: "Modifier la liste des invités" },
      { key: "event.invitations.manage", label: "Gérer les invitations" },
      { key: "event.invitations.checkin", label: "Contrôler les accès le jour J" },
      { key: "event.seating.view", label: "Voir le plan de table" },
      { key: "event.seating.manage", label: "Modifier le plan de table" },
    ],
  },
  {
    title: "Messagerie",
    permissions: [
      { key: "event.channels.view_all", label: "Lire tous les canaux de l'évènement" },
      { key: "event.channels.post", label: "Écrire dans les canaux" },
      { key: "event.channels.manage", label: "Créer et archiver des canaux" },
    ],
  },
  {
    title: "Enfants",
    permissions: [
      { key: "children.view_roster", label: "Voir la liste des enfants (identité, âge, parent)" },
      { key: "children.manage", label: "Inscrire et modifier les enfants" },
      { key: "children.view_sensitive", label: "Consulter les informations de santé des enfants", sensitive: true },
      { key: "children.record_attendance", label: "Pointer les présences" },
      { key: "children.handover", label: "Enregistrer la remise aux parents" },
      { key: "children.assign_staff", label: "Affecter le personnel de garde" },
      { key: "children.view_access_logs", label: "Consulter le journal d'accès aux données enfants" },
    ],
  },
  {
    title: "Données métier",
    permissions: [
      { key: "catering.view_dietary_counts", label: "Voir les décomptes alimentaires (traiteur)" },
      { key: "venue.view_logistics", label: "Voir la logistique du lieu" },
    ],
  },
];

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.key, p.label])));

export function permissionLabel(key: string): string {
  return PERMISSION_LABELS[key] ?? key;
}
