import { z } from "zod";
import { isValidDateOnly, isValidTime } from "@/lib/time";

export const dateOnlySchema = z
  .string()
  .trim()
  .refine((value) => isValidDateOnly(value), { error: "Date invalide (format attendu AAAA-MM-JJ)." });

export const timeSchema = z
  .string()
  .trim()
  .refine((value) => isValidTime(value), { error: "Heure invalide (format HH:MM)." });

export const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max} caractères maximum.` })
    .transform((value) => (value.length ? value : null))
    .nullable()
    .optional();

export const requiredString = (max: number, label = "Ce champ") =>
  z.string().trim().min(1, { error: `${label} est requis.` }).max(max, { error: `${max} caractères maximum.` });

export const emailSchema = z.email({ error: "Adresse email invalide." }).trim().toLowerCase().max(254);

export const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine((value) => value.length === 0 || /^[+\d][\d\s().-]{5,}$/.test(value), { error: "Numéro de téléphone invalide." })
  .transform((value) => (value.length ? value : null))
  .nullable()
  .optional();

export const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, { error: "Code postal à 5 chiffres attendu." });

export const smallCount = z.coerce.number().int({ error: "Nombre entier attendu." }).min(0).max(200);

export const centsSchema = z.coerce.number().int({ error: "Montant en centimes entier attendu." }).min(0).max(100_000_000);

export const triStateSchema = z.enum(["YES", "PARTIAL", "NO", "UNKNOWN"]);

export const eventTypeSchema = z.enum(["WEDDING", "PRIVATE_PARTY", "PROFESSIONAL", "OTHER"]);

export const cuidSchema = z.string().trim().min(10).max(40);

/** Converts FormData into a plain object (repeated keys become arrays). */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key.endsWith("[]")) {
      const base = key.slice(0, -2);
      const current = (result[base] as string[] | undefined) ?? [];
      current.push(value);
      result[base] = current;
    } else if (key in result) {
      const existing = result[key];
      result[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const flat = z.flattenError(error);
  const output: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(flat.fieldErrors as Record<string, string[] | undefined>)) {
    if (messages && messages.length) output[key] = messages;
  }
  if (flat.formErrors.length) output._form = flat.formErrors;
  return output;
}
