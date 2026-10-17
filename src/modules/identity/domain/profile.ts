import { z } from "zod";

/** Curated IANA zones (Europe + overseas France) offered in the profile form. */
export const TIMEZONES = [
  "Europe/Paris",
  "Europe/Brussels",
  "Europe/Luxembourg",
  "Europe/Zurich",
  "Europe/Monaco",
  "Europe/Andorra",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Vienna",
  "Europe/Prague",
  "Europe/Warsaw",
  "Europe/Copenhagen",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Helsinki",
  "Europe/Athens",
  "Europe/Bucharest",
  "Europe/Sofia",
  "Europe/Budapest",
  "Europe/Istanbul",
  "Europe/Kyiv",
  "Atlantic/Canary",
  "Atlantic/Reykjavik",
  "America/Martinique",
  "America/Guadeloupe",
  "America/Cayenne",
  "Indian/Reunion",
  "Indian/Mayotte",
  "Pacific/Noumea",
  "Pacific/Tahiti",
] as const;
export type Timezone = (typeof TIMEZONES)[number];
export const DEFAULT_TIMEZONE: Timezone = "Europe/Paris";

export const LOCALES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English (interface en français pour l'instant)" },
] as const;
export type Locale = (typeof LOCALES)[number]["value"];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/** French and international phone numbers, digits/spaces/dots/dashes, optional leading +. */
const phoneRegex = /^\+?[0-9][0-9 .-]{5,19}$/;

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis.").max(80, "80 caractères maximum."),
  lastName: z.string().trim().min(1, "Le nom est requis.").max(80, "80 caractères maximum."),
  phone: optionalText(30).refine((v) => v == null || phoneRegex.test(v), "Numéro de téléphone invalide."),
  city: optionalText(120),
  postalCode: optionalText(12).refine((v) => v == null || /^[0-9A-Za-z -]{3,12}$/.test(v), "Code postal invalide."),
  timezone: z.enum(TIMEZONES, { message: "Fuseau horaire non pris en charge." }),
  locale: z.enum(LOCALES.map((l) => l.value) as [Locale, ...Locale[]], { message: "Langue non prise en charge." }),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const PRIMARY_INTENTS = ["organizer", "professional"] as const;
export type PrimaryIntent = (typeof PRIMARY_INTENTS)[number];
export const primaryIntentSchema = z.enum(PRIMARY_INTENTS, { message: "Choix invalide." });

/** Display name stored in users.name (better-auth) from the profile fields. */
export function fullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

/** Best-effort split of a legacy single `name` into first/last for prefilled forms. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}
