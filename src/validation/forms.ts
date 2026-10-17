import { z } from "zod";
import { emailSchema, optionalString, phoneSchema, requiredString } from "@/validation/common";

const antiAbuse = {
  website: z.string().max(0, { error: "Formulaire invalide." }).optional(),
  privacyAccepted: z.literal("on", { error: "Vous devez prendre connaissance de la politique de confidentialité." }),
};

export const providerApplicationSchema = z.object({
  name: requiredString(120, "Votre nom"),
  email: emailSchema,
  phone: phoneSchema,
  city: requiredString(120, "Votre commune"),
  sector: requiredString(160, "Votre secteur d’intervention"),
  message: requiredString(2000, "Votre présentation"),
  ...antiAbuse,
});

export const partnerApplicationSchema = z.object({
  name: requiredString(120, "Votre nom"),
  organisation: requiredString(160, "Le nom du lieu"),
  email: emailSchema,
  phone: phoneSchema,
  city: requiredString(120, "La commune du lieu"),
  message: requiredString(2000, "Votre message"),
  ...antiAbuse,
});

export const contactMessageSchema = z.object({
  name: requiredString(120, "Votre nom"),
  email: emailSchema,
  subject: optionalString(160),
  message: requiredString(3000, "Votre message"),
  ...antiAbuse,
});
