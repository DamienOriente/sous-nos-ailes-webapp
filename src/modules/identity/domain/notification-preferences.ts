import { z } from "zod";

export const EMAIL_DIGESTS = ["immediate", "daily", "off"] as const;
export type EmailDigest = (typeof EMAIL_DIGESTS)[number];

export const EMAIL_DIGEST_LABELS: Record<EmailDigest, { label: string; description: string }> = {
  immediate: { label: "Immédiat", description: "Un e-mail à chaque notification importante." },
  daily: { label: "Résumé quotidien", description: "Un seul e-mail par jour regroupant les nouveautés." },
  off: { label: "Aucun e-mail", description: "Vous consultez vos notifications dans l'application uniquement." },
};

/** Notification types a user can toggle individually (mirrors NotificationType, UI labels in French). */
export const NOTIFICATION_TYPE_OPTIONS = [
  { key: "invitation_received", label: "Invitations reçues", description: "Quand on vous invite à rejoindre un évènement." },
  { key: "invitation_accepted", label: "Invitations acceptées", description: "Quand une personne invitée rejoint votre évènement." },
  { key: "new_message", label: "Nouveaux messages", description: "Messages dans les canaux de vos évènements." },
  { key: "inquiry_received", label: "Demandes de contact et devis", description: "Pour vos fiches professionnelles." },
  { key: "inquiry_updated", label: "Suivi de vos demandes", description: "Réponses des professionnels contactés." },
  { key: "quote_accepted", label: "Devis acceptés", description: "" },
  { key: "document_added", label: "Documents ajoutés", description: "Nouveaux documents partagés dans un évènement." },
  { key: "deadline", label: "Échéances", description: "Rappels de tâches et jalons." },
  { key: "schedule_changed", label: "Changements de planning", description: "" },
  { key: "member_added", label: "Nouveaux membres", description: "Quand une personne rejoint un évènement." },
  { key: "permission_changed", label: "Changements de droits", description: "" },
  { key: "profile_approved", label: "Validation de fiche", description: "Décisions de modération sur vos fiches." },
  { key: "changes_requested", label: "Modifications demandées", description: "" },
  { key: "payment_alert", label: "Alertes de paiement", description: "Abonnement et facturation." },
] as const;
export type ToggleableNotificationType = (typeof NOTIFICATION_TYPE_OPTIONS)[number]["key"];

const typeKeys = NOTIFICATION_TYPE_OPTIONS.map((o) => o.key) as [ToggleableNotificationType, ...ToggleableNotificationType[]];

export const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  emailDigest: z.enum(EMAIL_DIGESTS),
  /** Only disabled types are stored (true is the default and omitted). */
  types: z.partialRecord(z.enum(typeKeys), z.boolean()),
  marketingEmails: z.boolean(),
});
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

/** Keeps the JSON column minimal: a type is only listed when it is switched off. */
export function normalizeTypeOverrides(types: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(types).filter(([, enabled]) => enabled === false));
}
