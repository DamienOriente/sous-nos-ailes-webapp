import { z } from "zod";
import {
  cuidSchema,
  dateOnlySchema,
  emailSchema,
  eventTypeSchema,
  optionalString,
  phoneSchema,
  postalCodeSchema,
  requiredString,
  smallCount,
  timeSchema,
  triStateSchema,
} from "@/validation/common";

const MIN_FILL_TIME_MS = 3_000;

export const eventRequestSchema = z
  .object({
    eventType: eventTypeSchema,
    dateMode: z.enum(["FIXED", "FLEXIBLE"]),
    eventDate: z.union([dateOnlySchema, z.literal("")]).optional(),
    eventEndDate: z.union([dateOnlySchema, z.literal("")]).optional(),
    dateNote: optionalString(300),
    startTime: z.union([timeSchema, z.literal("")]).optional(),
    endTime: z.union([timeSchema, z.literal("")]).optional(),
    venueMode: z.enum(["PARTNER", "FREE"]),
    venueId: z.union([cuidSchema, z.literal("")]).optional(),
    venueName: optionalString(160),
    city: requiredString(120, "La commune"),
    postalCode: postalCodeSchema,
    childrenUnder3: smallCount.default(0),
    children3to5: smallCount.default(0),
    children6to10: smallCount.default(0),
    children11plus: smallCount.default(0),
    parentsOnSite: triStateSchema,
    dedicatedSpace: triStateSchema,
    optionCodes: z.array(z.string().trim().max(60)).max(20).default([]),
    organizerName: requiredString(120, "Votre nom"),
    organizerEmail: emailSchema,
    organizerPhone: phoneSchema,
    organizerRole: optionalString(80),
    message: optionalString(2000),
    privacyAccepted: z.literal("on", { error: "Vous devez prendre connaissance de la politique de confidentialité." }),
    marketingOptIn: z.literal("on").optional(),
    submissionKey: z.string().trim().min(8).max(64),
    // Anti-abuse: honeypot must stay empty, and the form must have been open a few seconds.
    website: z.string().max(0, { error: "Formulaire invalide." }).optional(),
    startedAt: z.coerce.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dateMode === "FIXED") {
      if (!data.eventDate) ctx.addIssue({ code: "custom", path: ["eventDate"], message: "Indiquez la date de l’événement ou choisissez « date encore incertaine »." });
      if (!data.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Indiquez l’heure de début de la garde." });
      if (!data.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Indiquez l’heure de fin de la garde." });
      if (data.eventDate && data.eventEndDate && data.eventEndDate < data.eventDate) {
        ctx.addIssue({ code: "custom", path: ["eventEndDate"], message: "La date de fin doit être postérieure ou égale à la date de début." });
      }
    } else if (!data.dateNote && !data.eventDate) {
      ctx.addIssue({ code: "custom", path: ["dateNote"], message: "Donnez-nous une indication de période (mois, saison, année)." });
    }
    if (data.venueMode === "PARTNER" && !data.venueId) {
      ctx.addIssue({ code: "custom", path: ["venueId"], message: "Choisissez un lieu partenaire ou indiquez un lieu libre." });
    }
    if (data.venueMode === "FREE" && !data.venueName) {
      ctx.addIssue({ code: "custom", path: ["venueName"], message: "Indiquez le nom ou le type de lieu (domaine, salle, chez vous…)." });
    }
    const total = data.childrenUnder3 + data.children3to5 + data.children6to10 + data.children11plus;
    if (total < 1) ctx.addIssue({ code: "custom", path: ["children3to5"], message: "Indiquez au moins un enfant à accueillir." });
    if (data.startedAt && Date.now() - data.startedAt < MIN_FILL_TIME_MS) {
      ctx.addIssue({ code: "custom", path: ["_form"], message: "Le formulaire a été envoyé trop vite. Vérifiez vos réponses puis renvoyez." });
    }
  });

export type EventRequestInput = z.infer<typeof eventRequestSchema>;

/** Keys of the guided form, grouped by step (used by the client component and tests). */
export const EVENT_REQUEST_STEPS = [
  { id: "event", title: "Votre événement", fields: ["eventType", "dateMode", "eventDate", "eventEndDate", "dateNote", "startTime", "endTime"] },
  { id: "place", title: "Le lieu", fields: ["venueMode", "venueId", "venueName", "city", "postalCode"] },
  { id: "children", title: "Les enfants", fields: ["childrenUnder3", "children3to5", "children6to10", "children11plus", "parentsOnSite", "dedicatedSpace", "optionCodes"] },
  { id: "contact", title: "Vos coordonnées", fields: ["organizerName", "organizerEmail", "organizerPhone", "organizerRole", "message", "privacyAccepted", "marketingOptIn"] },
  { id: "summary", title: "Récapitulatif", fields: [] },
] as const;
