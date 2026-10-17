export const INQUIRY_STATUSES = ["new", "viewed", "info_requested", "quoted", "accepted", "declined", "confirmed", "archived"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export type InquiryKind = "contact" | "availability" | "quote";

/**
 * Professional-side transitions. `viewed` is set automatically when the
 * professional opens the inquiry. `accepted` is the requester's answer to a
 * quote; the professional then `confirmed`s the booking.
 */
const PRO_TRANSITIONS: Record<InquiryStatus, readonly InquiryStatus[]> = {
  new: ["viewed", "info_requested", "quoted", "declined", "archived"],
  viewed: ["info_requested", "quoted", "declined", "archived"],
  info_requested: ["quoted", "declined", "archived", "viewed"],
  quoted: ["accepted", "declined", "archived", "info_requested"],
  accepted: ["confirmed", "declined", "archived"],
  declined: ["archived", "viewed"],
  confirmed: ["archived"],
  archived: [],
};

export function canTransitionInquiry(from: InquiryStatus, to: InquiryStatus): boolean {
  return PRO_TRANSITIONS[from].includes(to);
}

export function nextInquiryStatuses(from: InquiryStatus): readonly InquiryStatus[] {
  return PRO_TRANSITIONS[from];
}

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "Nouvelle",
  viewed: "Lue",
  info_requested: "Informations demandées",
  quoted: "Devis envoyé",
  accepted: "Devis accepté",
  declined: "Déclinée",
  confirmed: "Confirmée",
  archived: "Archivée",
};

export const INQUIRY_STATUS_TONES: Record<InquiryStatus, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  new: "primary",
  viewed: "info",
  info_requested: "warning",
  quoted: "info",
  accepted: "success",
  declined: "danger",
  confirmed: "success",
  archived: "neutral",
};

export const INQUIRY_KIND_LABELS: Record<InquiryKind, string> = {
  contact: "Prise de contact",
  availability: "Demande de disponibilité",
  quote: "Demande de devis",
};

/** Action buttons offered in the workspace for a status. */
export const INQUIRY_ACTIONS: Array<{ to: InquiryStatus; label: string; variant: "default" | "outline" | "destructive" }> = [
  { to: "info_requested", label: "Demander des précisions", variant: "outline" },
  { to: "quoted", label: "Envoyer un devis", variant: "default" },
  { to: "accepted", label: "Marquer le devis accepté", variant: "default" },
  { to: "confirmed", label: "Confirmer la prestation", variant: "default" },
  { to: "declined", label: "Décliner", variant: "destructive" },
  { to: "archived", label: "Archiver", variant: "outline" },
];
