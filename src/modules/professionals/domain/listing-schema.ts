import { z } from "zod";
import { isValidSiren, isValidSiret, normalizeSiret } from "./siret";

/** Shared Zod pieces for onboarding steps and the listing editor. */
export const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "es", label: "Espagnol" },
  { value: "it", label: "Italien" },
  { value: "de", label: "Allemand" },
  { value: "pt", label: "Portugais" },
  { value: "ar", label: "Arabe" },
  { value: "oc", label: "Occitan" },
  { value: "lsf", label: "Langue des signes française" },
] as const;

export const EVENT_TYPE_OPTIONS = [
  { value: "wedding", label: "Mariage" },
  { value: "baptism", label: "Baptême" },
  { value: "birthday", label: "Anniversaire" },
  { value: "seminar", label: "Séminaire" },
  { value: "corporate", label: "Évènement d'entreprise" },
  { value: "family_gathering", label: "Réunion familiale" },
  { value: "other", label: "Autre" },
] as const;

export const PRICE_UNITS = [
  { value: "hour", label: "par heure" },
  { value: "half_day", label: "par demi-journée" },
  { value: "day", label: "par jour" },
  { value: "event", label: "par évènement" },
  { value: "guest", label: "par invité" },
  { value: "child", label: "par enfant" },
] as const;

export const ORGANIZATION_TYPES = [
  { value: "sole_trader", label: "Micro-entrepreneur / entreprise individuelle" },
  { value: "company", label: "Société (SARL, SAS, EURL…)" },
  { value: "association", label: "Association" },
  { value: "public_body", label: "Organisme public" },
  { value: "other", label: "Autre" },
] as const;

const uuid = z.uuid();
const languageValues = LANGUAGE_OPTIONS.map((l) => l.value) as [string, ...string[]];
const eventTypeValues = EVENT_TYPE_OPTIONS.map((l) => l.value) as [string, ...string[]];
const priceUnitValues = PRICE_UNITS.map((l) => l.value) as [string, ...string[]];
export const ORGANIZATION_TYPE_VALUES = ["sole_trader", "company", "association", "public_body", "other"] as const;

export const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .pipe(z.url().or(z.literal("")))
  .optional();

export const step1Schema = z.object({
  primaryCategoryId: uuid,
  secondaryCategoryIds: z.array(uuid).max(4).default([]),
});

export const step2Schema = z
  .object({
    displayName: z.string().trim().min(2, "Au moins 2 caractères").max(80),
    organizationType: z.enum(ORGANIZATION_TYPE_VALUES),
    siret: z
      .string()
      .trim()
      .transform(normalizeSiret)
      .refine((v) => v === "" || isValidSiret(v) || isValidSiren(v), "SIREN (9 chiffres) ou SIRET (14 chiffres) invalide")
      .optional()
      .default(""),
    city: z.string().trim().min(2).max(80),
    postalCode: z.string().trim().regex(/^\d{5}$/, "Code postal à 5 chiffres"),
    interventionRadiusKm: z.coerce.number().int().min(0).max(500).default(50),
  });

export const step4Schema = z.object({
  tagline: z.string().trim().max(140).optional().default(""),
  description: z.string().trim().max(4000).optional().default(""),
  priceFromCents: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  priceToCents: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  priceUnit: z.enum(priceUnitValues).optional().or(z.literal("")),
  languages: z.array(z.enum(languageValues)).min(1, "Indiquez au moins une langue").default(["fr"]),
  eventTypes: z.array(z.enum(eventTypeValues)).default([]),
  yearsExperience: z.coerce.number().int().min(0).max(70).nullable().optional(),
  publicEmail: z.email("E-mail invalide").or(z.literal("")).optional(),
  publicPhone: z
    .string()
    .trim()
    .regex(/^(\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$|^$/, "Numéro français attendu")
    .optional(),
  website: optionalUrl,
  instagram: z.string().trim().max(100).optional(),
  facebook: z.string().trim().max(200).optional(),
  acceptsChildrenServices: z.boolean().default(false),
});

export const step5Schema = z.object({
  templateKey: z.string().trim().min(1).max(60),
});

export type Step1Input = z.infer<typeof step1Schema>;
export type Step2Input = z.infer<typeof step2Schema>;
export type Step4Input = z.infer<typeof step4Schema>;

/** Full editor: steps 2 + 4 + category (+ trade details validated separately). */
export const listingEditSchema = step2Schema.extend(step4Schema.shape).extend({ primaryCategoryId: uuid, secondaryCategoryIds: z.array(uuid).max(4).default([]) });
export type ListingEditInput = z.infer<typeof listingEditSchema>;

export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().default(""),
  priceCents: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  priceUnit: z.enum(priceUnitValues).optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int().min(0).max(10_000).nullable().optional(),
  minAge: z.coerce.number().int().min(0).max(18).nullable().optional(),
  maxAge: z.coerce.number().int().min(0).max(18).nullable().optional(),
  capacity: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  isActive: z.boolean().default(true),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

/** Weekly grid: weekday 0 (Monday) … 6 (Sunday); slots in minutes since midnight. */
export const availabilitySlotSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startMinute: z.coerce.number().int().min(0).max(1439),
    endMinute: z.coerce.number().int().min(1).max(1440),
  })
  .refine((s) => s.endMinute > s.startMinute, "L'heure de fin doit être après le début");
export const availabilityGridSchema = z.array(availabilitySlotSchema).max(42);

export const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

/** Three standard slots for the weekly grid UI. */
export const DAY_SLOTS = [
  { key: "morning", label: "Matin", startMinute: 8 * 60, endMinute: 12 * 60 },
  { key: "afternoon", label: "Après-midi", startMinute: 12 * 60, endMinute: 18 * 60 },
  { key: "evening", label: "Soirée", startMinute: 18 * 60, endMinute: 24 * 60 },
] as const;

export function labelFor<T extends readonly { value: string; label: string }[]>(options: T, value: string | null | undefined): string {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label ?? value;
}
