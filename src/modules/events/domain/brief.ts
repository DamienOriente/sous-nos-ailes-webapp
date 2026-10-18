import { z } from "zod";
import { EVENT_TYPE_LABELS, type EventType } from "./event-types";

/**
 * Shared event brief (2026-10-18): the organiser describes the event once; every provider
 * contacted from the event receives the same brief, frozen at sending time (snapshot on the
 * inquiry). The indicative budget is only sent when the organiser chose to share it.
 */
export type EventBrief = {
  eventType: EventType;
  eventTypeLabel: string;
  date: string | null;
  dateIsTentative: boolean;
  startTime: string | null;
  venueName: string | null;
  city: string | null;
  postalCode: string | null;
  guests: number | null;
  children: number | null;
  /** Null when the organiser did not share it. */
  budgetCents: number | null;
  style: string | null;
  needs: string | null;
};

export type BriefSource = {
  type: EventType;
  eventDate: string | null;
  dateIsTentative: boolean;
  startsAt: Date | null;
  timezone: string;
  venueName: string | null;
  city: string | null;
  postalCode: string | null;
  expectedGuests: number | null;
  expectedChildren: number | null;
  budgetCents: number | null;
  briefShareBudget: boolean;
  style: string | null;
  preferences: string | null;
};

function localTime(d: Date | null, timeZone: string): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone }).format(d);
}

export function buildBrief(e: BriefSource): EventBrief {
  return {
    eventType: e.type,
    eventTypeLabel: EVENT_TYPE_LABELS[e.type] ?? "Évènement",
    date: e.eventDate,
    dateIsTentative: e.dateIsTentative,
    startTime: localTime(e.startsAt, e.timezone),
    venueName: e.venueName?.trim() || null,
    city: e.city?.trim() || null,
    postalCode: e.postalCode?.trim() || null,
    guests: e.expectedGuests,
    children: e.expectedChildren,
    budgetCents: e.briefShareBudget ? e.budgetCents : null,
    style: e.style?.trim() || null,
    needs: e.preferences?.trim() || null,
  };
}

/** Fields a provider needs to answer without calling back; listed when missing. */
export function missingBriefFields(b: EventBrief): string[] {
  const missing: string[] = [];
  if (!b.date) missing.push("la date");
  if (!b.city) missing.push("la ville");
  if (b.guests === null) missing.push("le nombre d'invités");
  if (!b.style) missing.push("le style");
  return missing;
}

/** Plain-text rendering used in e-mails and as the inquiry message when the organiser adds nothing. */
export function briefSummary(b: EventBrief): string {
  const parts = [b.eventTypeLabel];
  if (b.date) parts.push(`le ${b.date}${b.dateIsTentative ? " (date à confirmer)" : ""}`);
  if (b.city) parts.push(`à ${b.city}`);
  if (b.guests !== null) parts.push(`${b.guests} invités`);
  if (b.children) parts.push(`dont ${b.children} enfants`);
  return parts.join(", ");
}

/** Narrowing for snapshots read back from jsonb. */
export function readBriefSnapshot(v: unknown): EventBrief | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Partial<EventBrief>;
  return typeof o.eventTypeLabel === "string" ? (o as EventBrief) : null;
}

export const briefUpdateSchema = z.object({
  style: z.string().trim().max(160).optional().default(""),
  preferences: z.string().trim().max(3000).optional().default(""),
  expectedGuests: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  expectedChildren: z.coerce.number().int().min(0).max(10_000).nullable().optional(),
  budgetEuros: z.coerce.number().min(0).max(10_000_000).nullable().optional(),
  briefShareBudget: z.coerce.boolean().default(false),
  venueName: z.string().trim().max(160).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  postalCode: z.string().trim().regex(/^(\d{5})?$/, "Code postal à 5 chiffres").optional().default(""),
  eventDate: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date au format AAAA-MM-JJ").optional().default(""),
});
export type BriefUpdateInput = z.infer<typeof briefUpdateSchema>;

export const sendBriefSchema = z.object({
  professionalIds: z.array(z.uuid()).min(1, "Choisissez au moins un professionnel").max(10, "Dix professionnels au plus par envoi"),
  kind: z.enum(["contact", "availability", "quote"]).default("quote"),
  message: z.string().trim().max(3000).optional().default(""),
});
export type SendBriefInput = z.infer<typeof sendBriefSchema>;
