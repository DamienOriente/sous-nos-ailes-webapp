/** Public report catalogue (pure: shared by the client form and the service). */
export const REPORT_REASONS = ["inappropriate", "fraud", "fake_review", "spam", "safety", "legal", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  inappropriate: "Contenu inapproprié ou offensant",
  fraud: "Arnaque ou activité frauduleuse",
  fake_review: "Faux avis",
  spam: "Spam ou publicité déguisée",
  safety: "Mise en danger (notamment d'un enfant)",
  legal: "Contenu illicite (droit d'auteur, droit à l'image, diffamation…)",
  other: "Autre",
};

export const REPORT_RESOURCE_TYPES = ["professional", "review", "message", "user", "page", "other"] as const;
export type ReportResourceType = (typeof REPORT_RESOURCE_TYPES)[number];
export const REPORT_RESOURCE_LABELS: Record<ReportResourceType, string> = {
  professional: "Une fiche professionnelle",
  review: "Un avis",
  message: "Un message",
  user: "Un compte",
  page: "Une page du site",
  other: "Autre",
};
