import type { Metadata } from "next";
import Link from "next/link";
import { listEventsForPlanning } from "@/server/services/events";
import { computeTeamStatus } from "@/domain/workflow";
import { addDaysToDateOnly, formatDateOnlyLong, formatEventWindow, getTimeZoneOffsetMinutes, isValidDateOnly, parseDateOnly, toDateOnlyString, zonedDateTimeToUtc } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EventStatusBadge, TeamStatusBadge } from "@/components/admin/badges";

export const metadata: Metadata = { title: "Planning" };

const WEEKS = 8;

/** Paris civil date of an instant, as "YYYY-MM-DD". */
function parisDateOf(instant: Date): string {
  return toDateOnlyString(new Date(instant.getTime() + getTimeZoneOffsetMinutes(instant) * 60_000));
}

/** Monday of the ISO week containing the given civil date. */
function mondayOf(dateOnly: string): string {
  const day = parseDateOnly(dateOnly).getUTCDay();
  return addDaysToDateOnly(dateOnly, -((day + 6) % 7));
}

export default async function PlanningPage({ searchParams }: PageProps<"/admin/planning">) {
  const params = await searchParams;
  const requested = typeof params.from === "string" && isValidDateOnly(params.from) ? params.from : parisDateOf(new Date());
  const start = mondayOf(requested);
  const endExclusive = addDaysToDateOnly(start, WEEKS * 7);
  const lastDay = addDaysToDateOnly(endExclusive, -1);
  const events = await listEventsForPlanning(zonedDateTimeToUtc(start, "00:00"), zonedDateTimeToUtc(lastDay, "23:59"));

  const weeks = Array.from({ length: WEEKS }, (_, index) => addDaysToDateOnly(start, index * 7));
  const byWeek = new Map<string, typeof events>(weeks.map((week) => [week, []]));
  for (const event of events) {
    const civil = event.startsAt ? parisDateOf(event.startsAt) : event.date ? toDateOnlyString(event.date) : null;
    if (!civil) continue;
    const week = mondayOf(civil);
    byWeek.get(week)?.push(event);
  }
  const today = parisDateOf(new Date());

  return (
    <>
      <PageHeader
        title="Planning"
        description={`Du ${formatDateOnlyLong(start)} au ${formatDateOnlyLong(lastDay)} : dossiers en cours, semaine par semaine.`}
        actions={
          <>
            <LinkButton href={`/admin/planning?from=${addDaysToDateOnly(start, -WEEKS * 7)}`} variant="secondary" size="sm">
              8 semaines avant
            </LinkButton>
            <LinkButton href="/admin/planning" variant="ghost" size="sm">
              Aujourd’hui
            </LinkButton>
            <LinkButton href={`/admin/planning?from=${endExclusive}`} variant="secondary" size="sm">
              8 semaines après
            </LinkButton>
          </>
        }
      />

      {events.length === 0 ? <EmptyState title="Aucun événement sur cette période" description="Seuls les dossiers en cours (de la demande à la confirmation) sont affichés." /> : null}

      <div className="flex flex-col gap-6">
        {weeks.map((week) => {
          const rows = byWeek.get(week) ?? [];
          const isCurrent = today >= week && today < addDaysToDateOnly(week, 7);
          return (
            <section key={week} aria-labelledby={`week-${week}`} className="flex flex-col gap-2">
              <h2 id={`week-${week}`} className="flex flex-wrap items-baseline gap-2 font-sans text-[15px] font-semibold text-ink-900">
                Semaine du {formatDateOnlyLong(week)}
                {isCurrent ? <span className="text-[13px] font-medium text-clay-700">(semaine en cours)</span> : null}
              </h2>
              {rows.length ? (
                <ul className="divide-y divide-sage-100 rounded-md border border-sage-200 bg-ivory-50">
                  {rows.map((event) => {
                    const teamStatus = computeTeamStatus({ requiredProviders: event.requiredProviders, assignedCount: event.assignments.length, pendingInvitations: 0, acceptedInvitationsNotAssigned: 0 });
                    return (
                      <li key={event.id} className="grid gap-2 px-4 py-3 lg:grid-cols-[2fr_3fr_auto] lg:items-center">
                        <p className="text-[15px] text-ink-700">{formatEventWindow({ date: event.date, startsAt: event.startsAt, endsAt: event.endsAt, startTime: event.startTime, endTime: event.endTime, dateIsFlexible: event.dateIsFlexible })}</p>
                        <div className="min-w-0">
                          <Link href={`/admin/evenements/${event.id}`} className="font-semibold text-sage-800 hover:underline">
                            {event.title}
                          </Link>
                          <p className="text-sm text-ink-500">
                            <span className="tabular">{event.reference}</span>
                            {" · "}
                            {event.venue?.name ?? event.venueName ?? "Lieu à préciser"}, {event.city}
                          </p>
                          <p className="text-sm text-ink-700">
                            {event.assignments.length ? `Équipe : ${event.assignments.map((a) => a.provider.displayName).join(", ")}` : "Personne affectée pour l’instant"}
                            {` (${event.assignments.length}/${event.requiredProviders})`}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                          <EventStatusBadge status={event.status} />
                          <TeamStatusBadge status={teamStatus} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-md border border-dashed border-sage-200 px-4 py-2 text-sm text-ink-500">Rien de prévu.</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
