import { EVENT_TYPE_LABELS, type EventType } from "@/modules/events/domain/event-types";

export function suggestedEventName(type: EventType, firstName: string, partnerOrChild?: string | null): string {
  const label = EVENT_TYPE_LABELS[type];
  const who = partnerOrChild?.trim() ? `${firstName} et ${partnerOrChild.trim()}` : firstName;
  switch (type) {
    case "wedding":
      return `Mariage de ${who}`;
    case "baptism":
      return `Baptême de ${partnerOrChild?.trim() || firstName}`;
    case "birthday":
      return `Anniversaire de ${partnerOrChild?.trim() || firstName}`;
    case "seminar":
      return `Séminaire ${partnerOrChild?.trim() || ""}`.trim();
    case "corporate":
      return `${label} ${partnerOrChild?.trim() || ""}`.trim();
    case "family_gathering":
      return `Réunion de famille ${partnerOrChild?.trim() || firstName}`;
    default:
      return `Évènement de ${firstName}`;
  }
}

/** Department code from a French postal code (Corsica + overseas handled). */
export function departmentFromPostalCode(postalCode: string | null | undefined): string | null {
  if (!postalCode || !/^\d{5}$/.test(postalCode)) return null;
  if (postalCode.startsWith("97") || postalCode.startsWith("98")) return postalCode.slice(0, 3);
  if (postalCode.startsWith("20")) return Number(postalCode) < 20200 ? "2A" : "2B";
  return postalCode.slice(0, 2);
}
