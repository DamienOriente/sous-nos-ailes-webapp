import { z } from "zod";
import { centsSchema, cuidSchema, dateOnlySchema, emailSchema, optionalString, phoneSchema, postalCodeSchema, requiredString, smallCount, timeSchema, triStateSchema, eventTypeSchema } from "@/validation/common";

export const quoteLineSchema = z.object({
  kind: z.enum(["SERVICE", "TRAVEL", "OPTION", "SURCHARGE", "DISCOUNT", "OTHER"]),
  label: requiredString(160, "Le libellé"),
  description: optionalString(300),
  quantityHundredths: z.coerce.number().int().min(1).max(1_000_000),
  unitPriceCents: z.coerce.number().int().min(-100_000_000).max(100_000_000),
});

export const quoteVersionSchema = z.object({
  title: requiredString(160, "Le titre"),
  introText: optionalString(2000),
  validUntil: z.union([dateOnlySchema, z.literal("")]).optional().transform((v) => (v ? v : null)),
  vatMode: z.enum(["NONE", "STANDARD"]),
  vatRateBps: z.coerce.number().int().min(0).max(10_000),
  lines: z.array(quoteLineSchema).min(1, { error: "Ajoutez au moins une ligne." }).max(40),
});

export const eventDetailsSchema = z.object({
  eventType: eventTypeSchema,
  date: z.union([dateOnlySchema, z.literal("")]).transform((v) => (v ? v : null)),
  endDate: z.union([dateOnlySchema, z.literal("")]).optional().transform((v) => (v ? v : null)),
  dateIsFlexible: z.literal("on").optional().transform((v) => v === "on"),
  dateNote: optionalString(300),
  startTime: z.union([timeSchema, z.literal("")]).transform((v) => (v ? v : null)),
  endTime: z.union([timeSchema, z.literal("")]).transform((v) => (v ? v : null)),
  venueId: z.union([cuidSchema, z.literal("")]).optional().transform((v) => (v ? v : null)),
  venueName: optionalString(160),
  venueAddressNote: optionalString(300),
  city: requiredString(120, "La commune"),
  postalCode: postalCodeSchema,
  childrenUnder3: smallCount.default(0),
  children3to5: smallCount.default(0),
  children6to10: smallCount.default(0),
  children11plus: smallCount.default(0),
  parentsOnSite: triStateSchema,
  dedicatedSpace: triStateSchema,
  requiredProviders: z.coerce.number().int().min(1).max(30),
  spaceDescription: optionalString(1000),
  meetingPoint: optionalString(300),
  onSiteContactName: optionalString(120),
  onSiteContactPhone: phoneSchema,
  scheduleNotes: optionalString(1000),
});

export const clientPreparationSchema = z.object({
  dedicatedSpace: triStateSchema,
  spaceDescription: optionalString(1000),
  meetingPoint: optionalString(300),
  onSiteContactName: optionalString(120),
  onSiteContactPhone: phoneSchema,
  scheduleNotes: optionalString(1000),
});

export const providerSchema = z.object({
  email: emailSchema,
  name: requiredString(120, "Le nom"),
  phone: phoneSchema,
  displayName: requiredString(80, "Le prénom d’affichage"),
  city: requiredString(120, "La commune"),
  postalCode: z.union([postalCodeSchema, z.literal("")]).optional().transform((v) => (v ? v : null)),
  sector: requiredString(160, "Le secteur d’intervention"),
  bio: optionalString(2000),
  skills: z.string().max(500).optional().transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20) : [])),
  costBasis: z.enum(["PER_MISSION", "PER_HOUR"]),
  agreedCostCents: centsSchema,
  costNote: optionalString(300),
});

export const availabilitySchema = z.object({
  kind: z.enum(["AVAILABLE", "UNAVAILABLE"]),
  startDate: dateOnlySchema,
  startTime: timeSchema,
  endDate: dateOnlySchema,
  endTime: timeSchema,
  note: optionalString(200),
});

export const qualificationSchema = z.object({
  label: requiredString(160, "L’intitulé"),
  issuer: optionalString(160),
  year: z.union([z.coerce.number().int().min(1950).max(2100), z.literal("")]).optional().transform((v) => (typeof v === "number" ? v : null)),
});

export const venueSchema = z.object({
  name: requiredString(160, "Le nom du lieu"),
  slug: optionalString(80),
  type: z.enum(["CHATEAU", "DOMAINE", "SALLE_DE_RECEPTION", "RESTAURANT", "HOTEL", "AUTRE"]),
  city: requiredString(120, "La commune"),
  postalCode: z.union([postalCodeSchema, z.literal("")]).optional().transform((v) => (v ? v : null)),
  region: optionalString(120),
  officialWebsite: z.union([z.url({ error: "Adresse de site invalide." }), z.literal("")]).optional().transform((v) => (v ? v : null)),
  summary: requiredString(400, "Le résumé"),
  description: requiredString(6000, "La présentation"),
  childrenSpaces: optionalString(2000),
  constraints: optionalString(2000),
  accessInfo: optionalString(2000),
  contactName: optionalString(120),
  contactEmail: z.union([emailSchema, z.literal("")]).optional().transform((v) => (v ? v : null)),
  contactPhone: phoneSchema,
  partnershipStatus: z.enum(["PROSPECT", "ACTIVE", "PAUSED", "ENDED"]),
  illustrationKey: z.enum(["domaine", "chateau", "salle", "jardin", "orangerie"]),
});

export const settingsSchema = z.object({
  brandName: requiredString(120, "Le nom"),
  tagline: requiredString(200, "La promesse"),
  ownerFirstName: requiredString(60, "Le prénom"),
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
  areaLabel: requiredString(200, "La zone"),
  hourlyRateCents: centsSchema,
  minimumHours: z.coerce.number().int().min(0).max(24),
  minimumAmountCents: z.union([centsSchema, z.literal("")]).optional().transform((v) => (typeof v === "number" && v > 0 ? v : null)),
  defaultTravelFeeCents: centsSchema,
  nightSurchargeStartHour: z.coerce.number().int().min(0).max(23),
  nightSurchargePercent: z.coerce.number().int().min(0).max(200),
  sundaySurchargePercent: z.coerce.number().int().min(0).max(200),
  vatMode: z.enum(["NONE", "STANDARD"]),
  vatRateBps: z.coerce.number().int().min(0).max(10_000),
  publicEstimateEnabled: z.literal("on").optional().transform((v) => v === "on"),
  publicEstimateMarginPct: z.coerce.number().int().min(0).max(100),
  ratioUnder3: z.coerce.number().int().min(1).max(20),
  ratio3to5: z.coerce.number().int().min(1).max(30),
  ratio6to10: z.coerce.number().int().min(1).max(30),
  ratio11plus: z.coerce.number().int().min(1).max(40),
  minProviders: z.coerce.number().int().min(1).max(10),
  travelBufferMinutes: z.coerce.number().int().min(0).max(600),
  invitationExpiryHours: z.coerce.number().int().min(1).max(720),
  dataRetentionMonths: z.coerce.number().int().min(1).max(120),
});

export const optionSchema = z.object({
  id: z.union([cuidSchema, z.literal("")]).optional().transform((v) => (v ? v : undefined)),
  code: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, { error: "Code en minuscules, chiffres et tirets." }),
  label: requiredString(120, "Le libellé"),
  description: optionalString(300),
  priceCents: centsSchema,
  pricingUnit: z.enum(["FLAT", "PER_HOUR", "PER_PROVIDER"]),
  isActive: z.literal("on").optional().transform((v) => v === "on"),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const noteSchema = z.object({ body: requiredString(4000, "La note") });
export const reasonSchema = z.object({ reason: optionalString(300) });
