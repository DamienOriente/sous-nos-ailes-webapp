/**
 * Notification catalogue — pure (no IO): shared by server services and client
 * components (icons, labels, filters).
 */
export type NotificationType =
  | "invitation_received"
  | "invitation_accepted"
  | "rsvp_received"
  | "new_message"
  | "inquiry_received"
  | "inquiry_updated"
  | "quote_accepted"
  | "document_added"
  | "deadline"
  | "schedule_changed"
  | "profile_approved"
  | "changes_requested"
  | "profile_rejected"
  | "payment_alert"
  | "member_added"
  | "permission_changed"
  | "system";

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "invitation_received",
  "invitation_accepted",
  "rsvp_received",
  "new_message",
  "inquiry_received",
  "inquiry_updated",
  "quote_accepted",
  "document_added",
  "deadline",
  "schedule_changed",
  "profile_approved",
  "changes_requested",
  "profile_rejected",
  "payment_alert",
  "member_added",
  "permission_changed",
  "system",
];

/** French labels used by the notification centre, the preferences page and e-mails. */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  invitation_received: "Invitation reçue",
  invitation_accepted: "Invitation acceptée",
  rsvp_received: "Réponse à une invitation",
  new_message: "Nouveau message",
  inquiry_received: "Demande reçue",
  inquiry_updated: "Demande mise à jour",
  quote_accepted: "Devis accepté",
  document_added: "Document ajouté",
  deadline: "Échéance",
  schedule_changed: "Planning modifié",
  profile_approved: "Fiche approuvée",
  changes_requested: "Modifications demandées",
  profile_rejected: "Fiche refusée",
  payment_alert: "Alerte de paiement",
  member_added: "Nouveau membre",
  permission_changed: "Droits modifiés",
  system: "Information",
};

export function isNotificationType(v: string): v is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(v);
}

/** Serialisable shape for client components (dates as ISO strings). */
export type NotificationItem = { id: string; type: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };
