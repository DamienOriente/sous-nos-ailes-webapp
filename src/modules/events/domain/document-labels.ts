export const DOCUMENT_KINDS = ["contract", "quote", "brief", "plan", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = { contract: "Contrat", quote: "Devis", brief: "Brief", plan: "Plan", other: "Autre" };
