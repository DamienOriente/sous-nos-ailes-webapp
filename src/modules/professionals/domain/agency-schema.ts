import { z } from "zod";
import { isValidSiret, normalizeSiret } from "./siret";

/** Structures that may become agencies. A sole trader (EI, micro-entreprise) keeps one listing. */
export const AGENCY_TYPE_VALUES = ["company", "association", "public_body"] as const;

export const AGENCY_TYPE_LABELS: Record<(typeof AGENCY_TYPE_VALUES)[number], string> = {
  company: "Société (SARL, SAS, EURL…)",
  association: "Association",
  public_body: "Organisme public",
};

export const AGENCY_STATUS_LABELS: Record<string, string> = {
  none: "Indépendant",
  pending: "Agence en cours de validation",
  verified: "Agence validée",
  rejected: "Demande d'agence refusée",
};

export const agencyRequestSchema = z.object({
  name: z.string().trim().min(2, "Au moins 2 caractères").max(120),
  type: z.enum(AGENCY_TYPE_VALUES, { message: "Choisissez le type de structure" }),
  siret: z.string().trim().transform(normalizeSiret).refine(isValidSiret, "SIRET invalide (14 chiffres)"),
  addressLine1: z.string().trim().min(3, "Adresse requise").max(160),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Code postal à 5 chiffres"),
  city: z.string().trim().min(2).max(80),
});

export type AgencyRequestInput = z.infer<typeof agencyRequestSchema>;
