import { z } from "zod";

/** Public inquiry form (anonymous or signed-in). `website` is the honeypot. */
export const publicInquirySchema = z.object({
  professionalId: z.uuid(),
  kind: z.enum(["contact", "availability", "quote"]).default("contact"),
  requesterName: z.string().trim().min(2, "Votre nom est requis").max(120),
  requesterEmail: z.email("E-mail invalide").max(200),
  requesterPhone: z.string().trim().max(30).optional().or(z.literal("")),
  eventTypeLabel: z.string().trim().max(60).optional().or(z.literal("")),
  eventDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ").optional().or(z.literal("")),
  eventCity: z.string().trim().max(80).optional().or(z.literal("")),
  guestsCount: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  childrenCount: z.coerce.number().int().min(0).max(10_000).nullable().optional(),
  // Optional when an event brief is attached (checked in the service); 10 characters otherwise.
  message: z.string().trim().max(3000).optional().default(""),
  consent: z.literal(true, { error: "Votre accord est nécessaire pour transmettre la demande" }),
  /** Honeypot: must stay empty. */
  website: z.string().max(0).optional().or(z.literal("")),
  eventId: z.uuid().optional().nullable(),
}).superRefine((v, ctx) => {
  if (!v.eventId && v.message.length < 10) ctx.addIssue({ code: "custom", path: ["message"], message: "Décrivez votre besoin en quelques mots (10 caractères minimum)" });
});
export type PublicInquiryInput = z.infer<typeof publicInquirySchema>;

export const inquiryReplySchema = z.object({
  message: z.string().trim().min(2).max(3000),
  toStatus: z.enum(["viewed", "info_requested", "quoted", "accepted", "declined", "confirmed", "archived"]).optional(),
});

export const inquiryQuoteSchema = z.object({
  quoteCents: z.coerce.number().int().min(0).max(100_000_000),
  quoteNote: z.string().trim().max(2000).optional().or(z.literal("")),
  quoteFileId: z.uuid().optional().nullable(),
  message: z.string().trim().max(3000).optional().or(z.literal("")),
});
