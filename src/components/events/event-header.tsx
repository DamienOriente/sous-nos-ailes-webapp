import Link from "next/link";
import { CalendarDays, ChevronLeft, MapPin, Users } from "lucide-react";
import { EventCover } from "@/components/events/event-cover";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn, formatDateFr } from "@/lib/utils";
import { EVENT_ROLE_LABELS, type EventRole } from "@/modules/authorization";
import { countdownLabel, daysUntil, EVENT_STATUS_TONES, toLocalDateString, type EventStatus } from "@/modules/events/domain/event-status";
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, type EventType } from "@/modules/events/domain/event-types";

export function Countdown({ eventDate, timezone, tentative, size = "md", onPhoto = false }: { eventDate: string | null; timezone: string; tentative?: boolean; size?: "sm" | "md" | "lg" | "xl"; onPhoto?: boolean }) {
  if (!eventDate) return <span className={cn("text-sm", onPhoto ? "text-white/85" : "text-muted-foreground")}>Date à définir</span>;
  const days = daysUntil(eventDate, toLocalDateString(new Date(), timezone));
  const label = countdownLabel(days);
  const [main, hint] = label.split(" · ");
  const cls = size === "xl" ? "text-5xl sm:text-6xl" : size === "lg" ? "text-3xl sm:text-4xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <span className="inline-flex flex-col leading-none" aria-label={`Compte à rebours : ${label}`}>
      <span className={cn("font-heading font-semibold tabular-nums", cls)}>{main}</span>
      {(hint || tentative) && (
        <span className={cn("mt-1 text-xs", onPhoto ? "text-white/80" : "text-muted-foreground")}>
          {[hint, tentative ? "date provisoire" : null].filter(Boolean).join(" · ")}
        </span>
      )}
    </span>
  );
}

export function EventHeader({
  event,
  role,
}: {
  event: { id: string; name: string; type: EventType; status: EventStatus; eventDate: string | null; dateIsTentative: boolean; timezone: string; venueName: string | null; city: string | null; expectedGuests: number | null; coverPhotoId: string | null; coverFileId: string | null };
  role: EventRole;
}) {
  return (
    <header className="relative overflow-hidden rounded-3xl border bg-card">
      <EventCover event={event} className="absolute inset-0" priority sizes="100vw" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/5" aria-hidden="true" />
      <div className="relative flex min-h-[15rem] flex-col justify-between gap-6 p-5 text-white sm:min-h-[17rem] sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <Link href="/app/evenements" className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm transition-colors hover:bg-white/25">
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Mes évènements
          </Link>
          <span className="rounded-full bg-white/90 px-1 py-0.5 dark:bg-black/60">
            <StatusBadge tone={EVENT_STATUS_TONES[event.status]}>{EVENT_STATUS_LABELS[event.status]}</StatusBadge>
          </span>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-white/80">
              {EVENT_TYPE_LABELS[event.type]} · <span className="text-white/70">{EVENT_ROLE_LABELS[role]}</span>
            </p>
            <h1 className="font-heading text-3xl font-semibold text-balance drop-shadow-sm sm:text-4xl">{event.name}</h1>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85">
              <li className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {event.eventDate ? formatDateFr(event.eventDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, event.timezone) : "Date à définir"}
                {event.dateIsTentative && event.eventDate ? " (provisoire)" : ""}
              </li>
              {(event.venueName || event.city) && (
                <li className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {[event.venueName, event.city].filter(Boolean).join(" · ")}
                </li>
              )}
              {event.expectedGuests !== null && (
                <li className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" aria-hidden="true" />
                  {event.expectedGuests} invités
                </li>
              )}
            </ul>
          </div>
          <div className="shrink-0 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm sm:text-right">
            <Countdown eventDate={event.eventDate} timezone={event.timezone} tentative={event.dateIsTentative} size="lg" onPhoto />
          </div>
        </div>
      </div>
    </header>
  );
}
