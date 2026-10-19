import { z } from "zod";
import { EVENT_TYPE_LABELS, type EventType } from "@/modules/events/domain/event-types";

/**
 * Verified reviews (2026-10-19): only an organiser who really worked with the professional
 * through the platform can rate them, once per collaboration, after the event day.
 * Proof is either the author's event where the professional was a confirmed provider, or a
 * booking (inquiry) the professional confirmed for the author.
 */
export const ORGANIZER_ROLES = ["owner", "lead_organizer", "co_organizer", "wedding_planner"] as const;

export const reviewInputSchema = z
  .object({
    professionalId: z.uuid(),
    eventId: z.uuid().optional().nullable(),
    inquiryId: z.uuid().optional().nullable(),
    rating: z.coerce.number().int().min(1, "Choisissez une note").max(5),
    title: z.string().trim().max(120).optional().default(""),
    body: z.string().trim().min(30, "Racontez en quelques phrases (30 caractères minimum)").max(2000),
  })
  .refine((v) => Boolean(v.eventId) !== Boolean(v.inquiryId), { message: "Prestation introuvable", path: ["professionalId"] });
export type ReviewInput = z.infer<typeof reviewInputSchema>;

/** The event day must be over (Paris calendar) before a review is possible. */
export function isPast(date: string | null, today: string): boolean {
  return Boolean(date && date < today);
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** "Mariage, juin 2026": what the verified badge says, without any private detail. */
export function verifiedLabel(kind: string | null, date: string | null): string | null {
  if (!kind && !date) return null;
  const label = kind ? ((EVENT_TYPE_LABELS as Record<string, string>)[kind as EventType] ?? kind) : "Prestation";
  if (!date || !/^\d{4}-\d{2}/.test(date)) return label;
  return `${label}, ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}
