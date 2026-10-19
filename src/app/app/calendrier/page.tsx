import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarView, type CalendarViewKind, type ClientOccurrence } from "@/components/calendar/calendar-view";
import { EntryDialog } from "@/components/calendar/entry-dialog";
import { requireActor } from "@/lib/session";
import { ENTRY_KINDS, ENTRY_KIND_LABELS, getUserTimezone, listEntriesByIds, listOccurrences, listOwnProfessionals, type EntryKind } from "@/modules/calendar/application/calendar-service";
import { addDaysTz, dayKey, startOfDayTz, startOfMonthTz, startOfWeekTz, toLocalInputValue } from "@/modules/calendar/domain/datetime";
import { createEntryAction, deleteEntryAction, excludeOccurrenceAction, updateEntryAction } from "./actions";

export const metadata = { title: "Calendrier" };

type Search = { view?: string; date?: string; scope?: string; kind?: string; pro?: string };
const VIEWS: CalendarViewKind[] = ["day", "week", "month", "agenda"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requireActor("/app/calendrier");
  const sp = await searchParams;
  const timezone = await getUserTimezone(actor.userId);
  const now = new Date();
  const todayKey = dayKey(now, timezone);
  const requestedDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? new Date(`${sp.date}T12:00:00Z`) : null;
  const anchor = requestedDate && !Number.isNaN(requestedDate.getTime()) ? startOfDayTz(requestedDate, timezone) : startOfDayTz(now, timezone);
  const view: CalendarViewKind = VIEWS.includes(sp.view as CalendarViewKind) ? (sp.view as CalendarViewKind) : "agenda";
  const scope = sp.scope === "pro" || sp.scope === "events" ? sp.scope : "all";
  const kind = ENTRY_KINDS.includes(sp.kind as EntryKind) ? (sp.kind as EntryKind) : null;

  // Range for the view (month grid = 6 weeks starting Monday; agenda = 30 days).
  const monthStart = startOfWeekTz(startOfMonthTz(anchor, timezone), timezone);
  const monthEnd = addDaysTz(monthStart, 42, timezone);
  const weekStart = startOfWeekTz(anchor, timezone);
  const range =
    view === "month" ? { from: monthStart, to: monthEnd } : view === "week" ? { from: weekStart, to: addDaysTz(weekStart, 7, timezone) } : view === "day" ? { from: anchor, to: addDaysTz(anchor, 1, timezone) } : { from: anchor, to: addDaysTz(anchor, 30, timezone) };

  const [{ occurrences }, professionals] = await Promise.all([listOccurrences(actor, range.from, range.to, { scope, kind, professionalId: sp.pro ?? null }), listOwnProfessionals(actor)]);
  const entries = await listEntriesByIds(actor, [...new Set(occurrences.filter((o) => !o.readOnly).map((o) => o.entryId))]);
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const client: ClientOccurrence[] = occurrences.map((o) => {
    const e = entryById.get(o.entryId);
    return {
      id: o.id,
      entryId: o.entryId,
      title: o.title,
      kind: o.kind,
      start: o.start.toISOString(),
      end: o.end.toISOString(),
      allDay: o.allDay,
      location: o.location,
      description: o.description,
      recurring: o.recurring,
      readOnly: o.readOnly,
      href: o.href,
      conflict: o.conflict,
      rrule: e?.rrule ?? null,
      reminderMinutesBefore: e?.reminderMinutesBefore ?? null,
      professionalId: o.professionalId,
      startLocal: toLocalInputValue(o.start, timezone),
      endLocal: toLocalInputValue(o.allDay ? new Date(o.end.getTime() - 1) : o.end, timezone),
      dayKey: dayKey(o.start, timezone),
    };
  });
  const weekDays = Array.from({ length: 7 }, (_, i) => dayKey(addDaysTz(weekStart, i, timezone), timezone));
  const monthDays = Array.from({ length: 42 }, (_, i) => dayKey(addDaysTz(monthStart, i, timezone), timezone));
  const filterHref = (patch: Partial<Search>) => {
    const p = new URLSearchParams({ view, date: dayKey(anchor, timezone), scope, ...(kind ? { kind } : {}), ...(sp.pro ? { pro: sp.pro } : {}) });
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/app/calendrier?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendrier"
        description={`Prestations, disponibilités et évènements, affichés dans votre fuseau (${timezone}). Les entrées liées à un évènement sont en lecture seule.`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/calendrier/connexions">
                 Connexions
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/calendrier/import">
                 Importer ICS
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/api/calendar/ics" download>
                <Download className="size-4" aria-hidden="true" /> Exporter ICS
              </a>
            </Button>
            <EntryDialog
              trigger={
                <Button size="sm">
                   Nouvelle entrée
                </Button>
              }
              timezone={timezone}
              professionals={professionals}
              initial={{ startsAtLocal: `${dayKey(anchor, timezone)}T09:00`, endsAtLocal: `${dayKey(anchor, timezone)}T10:00` }}
              action={createEntryAction}
            />
          </>
        }
      />

      <nav aria-label="Filtres" className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Afficher :</span>
        {[
          { v: "all", label: "Tout" },
          { v: "pro", label: "Mes fiches pro" },
          { v: "events", label: "Mes évènements" },
        ].map((f) => (
          <Link key={f.v} href={filterHref({ scope: f.v, pro: undefined })} aria-current={scope === f.v ? "page" : undefined} className={`rounded-full border px-3 py-1 ${scope === f.v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {f.label}
          </Link>
        ))}
        {scope === "pro" && professionals.length > 1 && (
          <span className="flex flex-wrap gap-1">
            {professionals.map((p) => (
              <Link key={p.id} href={filterHref({ pro: p.id })} className={`rounded-full border px-3 py-1 text-xs ${sp.pro === p.id ? "bg-secondary" : "hover:bg-muted"}`}>
                {p.displayName}
              </Link>
            ))}
          </span>
        )}
        <span className="ml-2 text-muted-foreground">Type :</span>
        <Link href={filterHref({ kind: undefined })} className={`rounded-full border px-3 py-1 ${!kind ? "bg-secondary" : "hover:bg-muted"}`}>
          Tous
        </Link>
        {ENTRY_KINDS.map((k) => (
          <Link key={k} href={filterHref({ kind: k })} className={`rounded-full border px-3 py-1 ${kind === k ? "bg-secondary" : "hover:bg-muted"}`}>
            {ENTRY_KIND_LABELS[k]}
          </Link>
        ))}
      </nav>

      <CalendarView
        occurrences={client}
        view={view}
        dateKey={dayKey(anchor, timezone)}
        todayKey={todayKey}
        timezone={timezone}
        professionals={professionals}
        weekDays={weekDays}
        monthDays={monthDays}
        actions={{ create: createEntryAction, update: updateEntryAction, remove: deleteEntryAction, excludeOccurrence: excludeOccurrenceAction }}
      />
      <p className="text-xs text-muted-foreground">Raccourcis clavier : flèches gauche et droite pour changer de période, T pour aujourd'hui, 1 à 4 pour changer de vue.</p>
    </div>
  );
}

