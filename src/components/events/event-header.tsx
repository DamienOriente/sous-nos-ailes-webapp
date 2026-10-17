import Link from "next/link";
import { CalendarDays, ChevronLeft, MapPin, Users } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateFr } from "@/lib/utils";
import { EVENT_ROLE_LABELS, type EventRole } from "@/modules/authorization";
import { countdownLabel, daysUntil, EVENT_STATUS_TONES, toLocalDateString, type EventStatus } from "@/modules/events/domain/event-status";
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, type EventType } from "@/modules/events/domain/event-types";

export function Countdown({ eventDate, timezone, tentative, size = "md" }: { eventDate: string | null; timezone: string; tentative?: boolean; size?: "sm" | "md" | "lg" }) {
  if (!eventDate) return <span className="text-sm text-muted-foreground">Date à définir</span>;
  const days = daysUntil(eventDate, toLocalDateString(new Date(), timezone));
  const label = countdownLabel(days);
  const cls = size === "lg" ? "text-3xl sm:text-4xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <span className="inline-flex flex-col leading-tight" aria-label={`Compte à rebours : ${label}`}>
      <span className={`font-heading font-semibold tabular-nums ${cls}`}>{label}</span>
      {tentative && <span className="text-xs text-muted-foreground">date provisoire</span>}
    </span>
  );
}

export function EventHeader({
  event,
  role,
}: {
  event: { id: string; name: string; type: EventType; status: EventStatus; eventDate: string | null; dateIsTentative: boolean; timezone: string; venueName: string | null; city: string | null; expectedGuests: number | null };
  role: EventRole;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-2xl border bg-card px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-2">
        <Link href="/app/evenements" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Mes évènements
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold text-balance sm:text-3xl">{event.name}</h1>
          <StatusBadge tone={EVENT_STATUS_TONES[event.status]}>{EVENT_STATUS_LABELS[event.status]}</StatusBadge>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li>{EVENT_TYPE_LABELS[event.type]}</li>
          <li className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {event.eventDate ? formatDateFr(event.eventDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, event.timezone) : "Date à définir"}
            {event.dateIsTentative && event.eventDate ? " (provisoire)" : ""}
          </li>
          {(event.venueName || event.city) && (
            <li className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {[event.venueName, event.city].filter(Boolean).join(" · ")}
            </li>
          )}
          {event.expectedGuests !== null && (
            <li className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden="true" />
              {event.expectedGuests} invités
            </li>
          )}
          <li className="text-xs uppercase tracking-wide">{EVENT_ROLE_LABELS[role]}</li>
        </ul>
      </div>
      <div className="shrink-0 sm:text-right">
        <Countdown eventDate={event.eventDate} timezone={event.timezone} tentative={event.dateIsTentative} />
      </div>
    </header>
  );
}
