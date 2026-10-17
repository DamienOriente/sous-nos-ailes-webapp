import type { EVENT_STATUS_LABELS } from "@/modules/events/domain/event-types";

export type EventStatus = keyof typeof EVENT_STATUS_LABELS;

/**
 * Lifecycle of an event. Terminal-ish states (completed, cancelled) can only
 * be archived; archived is final. Cancelling is possible from any live state.
 */
export const EVENT_STATUS_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  planning: ["confirmed", "in_progress", "cancelled", "archived"],
  confirmed: ["planning", "in_progress", "completed", "cancelled", "archived"],
  in_progress: ["completed", "cancelled", "archived"],
  completed: ["archived"],
  cancelled: ["planning", "archived"],
  archived: [],
};

export function canTransitionEventStatus(from: EventStatus, to: EventStatus): boolean {
  return EVENT_STATUS_TRANSITIONS[from].includes(to);
}

export function nextEventStatuses(from: EventStatus): readonly EventStatus[] {
  return EVENT_STATUS_TRANSITIONS[from];
}

export const EVENT_STATUS_TONES: Record<EventStatus, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  planning: "info",
  confirmed: "primary",
  in_progress: "warning",
  completed: "success",
  cancelled: "danger",
  archived: "neutral",
};

/** Whether the workspace is still editable (tasks, budget...). */
export function isEventLive(status: EventStatus): boolean {
  return status === "planning" || status === "confirmed" || status === "in_progress";
}

/**
 * Days between `today` and the event date (both "YYYY-MM-DD" in the event's
 * timezone). Negative when the event is past. Pure: the caller supplies today.
 */
export function daysUntil(eventDate: string, today: string): number {
  const a = Date.UTC(Number(eventDate.slice(0, 4)), Number(eventDate.slice(5, 7)) - 1, Number(eventDate.slice(8, 10)));
  const b = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  return Math.round((a - b) / 86_400_000);
}

export function countdownLabel(days: number): string {
  if (days === 0) return "C'est aujourd'hui !";
  if (days === 1) return "C'est demain";
  if (days < 0) return days === -1 ? "Hier" : `Il y a ${Math.abs(days)} jours`;
  if (days >= 60) {
    const months = Math.floor(days / 30);
    return `J-${days} · environ ${months} mois`;
  }
  return `J-${days}`;
}

/** "YYYY-MM-DD" of `date` in the given IANA timezone. */
export function toLocalDateString(date: Date, timeZone = "Europe/Paris"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
