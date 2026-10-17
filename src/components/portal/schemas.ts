import { z } from "zod";
import { cuidSchema, optionalString, postalCodeSchema, requiredString } from "@/validation/common";

/** Fields a provider may edit on their own profile: never costs, vetting or activity flags. */
export const providerProfileSchema = z.object({
  displayName: requiredString(80, "Le prénom d’affichage"),
  city: requiredString(120, "La commune"),
  postalCode: z
    .union([postalCodeSchema, z.literal("")])
    .optional()
    .transform((value) => (value ? value : null)),
  sector: requiredString(160, "Le secteur d’intervention"),
  bio: optionalString(2000),
  skills: z
    .string()
    .max(500, { error: "500 caractères maximum." })
    .optional()
    .transform((value) => (value ? value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20) : [])),
});

export const invitationResponseSchema = z.object({
  invitationId: cuidSchema,
  response: z.enum(["ACCEPTED", "DECLINED"]),
  note: optionalString(500),
  returnTo: z.string().max(200).optional(),
});

export const acceptProposalSchema = z.object({
  eventId: cuidSchema,
  versionId: cuidSchema,
});
