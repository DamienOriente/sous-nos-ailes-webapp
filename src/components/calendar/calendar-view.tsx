"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { CalendarScene } from "@/components/illustrations";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { ENTRY_KIND_LABELS, type EntryKind } from "@/modules/calendar/domain/constants";
import { describeRRule } from "@/modules/calendar/domain/rrule";
import { EntryDialog, type EntryFormInitial } from "./entry-dialog";

export type ClientOccurrence = {
  id: string;
  entryId: string;
  title: string;
  kind: EntryKind;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  recurring: boolean;
  readOnly: boolean;
  href: string | null;
  conflict: boolean;
  rrule: string | null;
  reminderMinutesBefore: number | null;
  professionalId: string | null;
  startLocal: string; // YYYY-MM-DDTHH:mm in the user's zone (for edit defaults)
  endLocal: string;
  dayKey: string; // YYYY-MM-DD in the user's zone
};

export type CalendarViewKind = "day" | "week" | "month" | "agenda";

const KIND_COLORS: Record<EntryKind, string> = {
  event: "bg-primary/15 text-primary",
  service: "bg-gold/20 text-foreground",
  availability: "bg-success/15 text-success",
  unavailability: "bg-muted text-muted-foreground border-border line-through",
  reminder: "bg-sky/20 text-foreground",
  other: "bg-secondary text-secondary-foreground border-border",
};

const fmtTime = (iso: string, tz: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const fmtDay = (key: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${key}T12:00:00Z`));
const fmtDayShort = (key: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" }).format(new Date(`${key}T12:00:00Z`));
const shiftKey = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const monthLabel = (key: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${key}T12:00:00Z`));

/**
 * Day / week / month / agenda views over pre-expanded occurrences. Navigation
 * is URL-driven (?view&date) so the server fetches the right range; keyboard:
 * ← → navigate, T today, 1-4 switch views.
 */
export function CalendarView({
  occurrences,
  view,
  dateKey,
  todayKey,
  timezone,
  professionals,
  weekDays,
  monthDays,
  actions,
}: {
  occurrences: ClientOccurrence[];
  view: CalendarViewKind;
  dateKey: string;
  todayKey: string;
  timezone: string;
  professionals: Array<{ id: string; displayName: string }>;
  weekDays: string[];
  monthDays: string[];
  actions: {
    create: (fd: FormData) => Promise<ActionResult<unknown>>;
    update: (entryId: string, fd: FormData) => Promise<ActionResult<unknown>>;
    remove: (entryId: string) => Promise<ActionResult<unknown>>;
    excludeOccurrence: (entryId: string, startIso: string) => Promise<ActionResult<unknown>>;
  };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ClientOccurrence | null>(null);

  const go = (next: Partial<{ view: CalendarViewKind; date: string }>) => {
    const params = new URLSearchParams(window.location.search);
    if (next.view) params.set("view", next.view);
    if (next.date) params.set("date", next.date);
    router.push(`/app/calendrier?${params.toString()}`);
  };
  const step = (dir: 1 | -1) => {
    if (view === "day") return go({ date: shiftKey(dateKey, dir) });
    if (view === "week") return go({ date: shiftKey(dateKey, 7 * dir) });
    if (view === "agenda") return go({ date: shiftKey(dateKey, 30 * dir) });
    const d = new Date(`${dateKey.slice(0, 7)}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + dir);
    return go({ date: d.toISOString().slice(0, 10) });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key.toLowerCase() === "t") go({ date: todayKey });
      else if (e.key === "1") go({ view: "day" });
      else if (e.key === "2") go({ view: "week" });
      else if (e.key === "3") go({ view: "month" });
      else if (e.key === "4") go({ view: "agenda" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dateKey, todayKey]);

  const byDay = useMemo(() => {
    const map = new Map<string, ClientOccurrence[]>();
    for (const o of occurrences) {
      // Multi-day occurrences appear on each day they cover (capped at 14 days).
      let key = o.dayKey;
      const endKey = new Date(o.end).getTime() - 1 > new Date(o.start).getTime() ? localKey(new Date(new Date(o.end).getTime() - 1), timezone) : key;
      for (let i = 0; i < 14 && key <= endKey; i++) {
        map.set(key, [...(map.get(key) ?? []), o]);
        key = shiftKey(key, 1);
      }
    }
    return map;
  }, [occurrences, timezone]);

  const conflictCount = new Set(occurrences.filter((o) => o.conflict).map((o) => o.entryId)).size;

  const heading = view === "month" ? monthLabel(dateKey) : view === "week" ? `Semaine du ${fmtDay(weekDays[0] ?? dateKey)}` : view === "day" ? fmtDay(dateKey) : `À partir du ${fmtDay(dateKey)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Période précédente" onClick={() => step(-1)}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Période suivante" onClick={() => step(1)}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => go({ date: todayKey })}>
            Aujourd'hui
          </Button>
          <h2 className="ml-2 text-base font-semibold capitalize sm:text-lg" aria-live="polite">
            {heading}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {conflictCount > 0 && (
            <StatusBadge tone="warning">
               {conflictCount} conflit{conflictCount > 1 ? "s" : ""}
            </StatusBadge>
          )}
          <div role="tablist" aria-label="Vue" className="inline-flex rounded-lg border p-0.5">
            {(["day", "week", "month", "agenda"] as CalendarViewKind[]).map((v, i) => (
              <button key={v} role="tab" aria-selected={view === v} className={cn("rounded-md px-2.5 py-1 text-xs font-medium sm:text-sm", view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted")} onClick={() => go({ view: v })} title={`Raccourci : ${i + 1}`}>
                {v === "day" ? "Jour" : v === "week" ? "Semaine" : v === "month" ? "Mois" : "Agenda"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "agenda" && <AgendaView occurrences={occurrences} tz={timezone} onSelect={setSelected} />}
      {view === "day" && <DayView dayKey={dateKey} items={byDay.get(dateKey) ?? []} tz={timezone} onSelect={setSelected} />}
      {view === "week" && <WeekView days={weekDays} byDay={byDay} tz={timezone} todayKey={todayKey} onSelect={setSelected} onDay={(d) => go({ view: "day", date: d })} />}
      {view === "month" && <MonthView days={monthDays} dateKey={dateKey} byDay={byDay} tz={timezone} todayKey={todayKey} onSelect={setSelected} onDay={(d) => go({ view: "day", date: d })} />}

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {selected.title}
                <StatusBadge tone="neutral" dot={false}>
                  {ENTRY_KIND_LABELS[selected.kind]}
                </StatusBadge>
                {selected.conflict && (
                  <StatusBadge tone="warning">
                     Conflit
                  </StatusBadge>
                )}
              </DialogTitle>
              <DialogDescription>
                {selected.allDay ? fmtDay(selected.dayKey) : `${fmtDay(selected.dayKey)} · ${fmtTime(selected.start, timezone)} – ${fmtTime(selected.end, timezone)}`}
                {selected.location ? ` · ${selected.location}` : ""}
              </DialogDescription>
            </DialogHeader>
            {selected.recurring && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                 {describeRRule(selected.rrule)}
              </p>
            )}
            {selected.description && <p className="whitespace-pre-wrap text-sm">{selected.description}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {selected.href && (
                <Button asChild variant="outline" size="sm">
                  <Link href={selected.href}>
                    <ExternalLink className="size-4" aria-hidden="true" /> Ouvrir l'évènement
                  </Link>
                </Button>
              )}
              {!selected.readOnly && (
                <>
                  <EntryDialog
                    trigger={
                      <Button variant="outline" size="sm">
                         Modifier
                      </Button>
                    }
                    timezone={timezone}
                    professionals={professionals}
                    initial={toInitial(selected)}
                    action={async (fd) => {
                      const res = await actions.update(selected.entryId, fd);
                      if (res.ok) setSelected(null);
                      return res;
                    }}
                  />
                  {selected.recurring && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline" size="sm">
                          Supprimer cette occurrence
                        </Button>
                      }
                      title="Supprimer cette occurrence ?"
                      description="Seule cette date est retirée ; la série continue."
                      onConfirm={async () => {
                        const res = await actions.excludeOccurrence(selected.entryId, selected.start);
                        if (res.ok) {
                          toast.success("Occurrence supprimée.");
                          setSelected(null);
                        }
                        return res;
                      }}
                    />
                  )}
                  <ConfirmDialog
                    trigger={
                      <Button variant="destructive" size="sm">
                         Supprimer
                      </Button>
                    }
                    title={selected.recurring ? "Supprimer toute la série ?" : "Supprimer cette entrée ?"}
                    description={selected.title}
                    onConfirm={async () => {
                      const res = await actions.remove(selected.entryId);
                      if (res.ok) {
                        toast.success("Entrée supprimée.");
                        setSelected(null);
                      }
                      return res;
                    }}
                  />
                </>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function localKey(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function toInitial(o: ClientOccurrence): EntryFormInitial {
  return { id: o.entryId, title: o.title, description: o.description, location: o.location, kind: o.kind, startsAtLocal: o.startLocal, endsAtLocal: o.endLocal, allDay: o.allDay, rrule: o.rrule, reminderMinutesBefore: o.reminderMinutesBefore, professionalId: o.professionalId };
}

function Chip({ o, tz, onSelect, compact = false }: { o: ClientOccurrence; tz: string; onSelect: (o: ClientOccurrence) => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(o)}
      className={cn("flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition-colors hover:brightness-95", KIND_COLORS[o.kind], o.conflict && "ring-1 ring-warning")}
      data-testid="calendar-occurrence"
      aria-label={`${o.title}, ${o.allDay ? "journée entière" : fmtTime(o.start, tz)}${o.conflict ? ", en conflit" : ""}`}
    >
      {!o.allDay && <span className="shrink-0 tabular-nums">{fmtTime(o.start, tz)}</span>}
      <span className={cn("truncate", !compact && "font-medium")}>{o.title}</span>
      {o.recurring && <span className="ml-auto shrink-0 text-[11px] opacity-70">récurrent</span>}
    </button>
  );
}

function AgendaView({ occurrences, tz, onSelect }: { occurrences: ClientOccurrence[]; tz: string; onSelect: (o: ClientOccurrence) => void }) {
  if (!occurrences.length) return <IllustratedEmpty scene={CalendarScene} compact title="Rien de prévu sur cette période" description="Vos prestations, disponibilités et évènements s'affichent ici ; les entrées liées à un évènement se créent depuis son espace. Changez de période avec les flèches ou créez une entrée." example="Repérage lumière au domaine, samedi 29 mai, de 17:00 à 19:30" testId="calendar-empty" />;
  const groups = new Map<string, ClientOccurrence[]>();
  for (const o of occurrences) groups.set(o.dayKey, [...(groups.get(o.dayKey) ?? []), o]);
  return (
    <ol className="space-y-4">
      {[...groups.entries()].map(([day, items]) => (
        <li key={day}>
          <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">{fmtDay(day)}</h3>
          <ul className="space-y-1.5">
            {items.map((o) => (
              <li key={o.id}>
                <Chip o={o} tz={tz} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function DayView({ dayKey, items, tz, onSelect }: { dayKey: string; items: ClientOccurrence[]; tz: string; onSelect: (o: ClientOccurrence) => void }) {
  const allDay = items.filter((o) => o.allDay);
  const timed = items.filter((o) => !o.allDay);
  return (
    <div className="rounded-2xl border bg-card p-4">
      <h3 className="sr-only">{fmtDay(dayKey)}</h3>
      {allDay.length > 0 && (
        <div className="mb-3 space-y-1">
          {allDay.map((o) => (
            <Chip key={o.id} o={o} tz={tz} onSelect={onSelect} />
          ))}
        </div>
      )}
      {timed.length === 0 && allDay.length === 0 && <p className="text-sm text-muted-foreground">Rien de prévu ce jour.</p>}
      <ol className="space-y-1.5">
        {timed.map((o) => (
          <li key={o.id} className="flex items-start gap-3">
            <span className="w-24 shrink-0 pt-1 text-xs tabular-nums text-muted-foreground">
              {fmtTime(o.start, tz)} – {fmtTime(o.end, tz)}
            </span>
            <Chip o={o} tz={tz} onSelect={onSelect} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function WeekView({ days, byDay, tz, todayKey, onSelect, onDay }: { days: string[]; byDay: Map<string, ClientOccurrence[]>; tz: string; todayKey: string; onSelect: (o: ClientOccurrence) => void; onDay: (d: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-7">
      {days.map((d) => (
        <section key={d} className={cn("min-h-28 rounded-xl border bg-card p-2", d === todayKey && "border-primary")}>
          <button type="button" onClick={() => onDay(d)} className="mb-1.5 text-xs font-semibold capitalize hover:underline">
            {fmtDayShort(d)}
          </button>
          <div className="space-y-1">
            {(byDay.get(d) ?? []).map((o) => (
              <Chip key={o.id} o={o} tz={tz} onSelect={onSelect} compact />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MonthView({ days, dateKey, byDay, tz, todayKey, onSelect, onDay }: { days: string[]; dateKey: string; byDay: Map<string, ClientOccurrence[]>; tz: string; todayKey: string; onSelect: (o: ClientOccurrence) => void; onDay: (d: string) => void }) {
  const month = dateKey.slice(0, 7);
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="hidden grid-cols-7 border-b text-center text-xs font-semibold text-muted-foreground sm:grid">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-7">
        {days.map((d) => {
          const items = byDay.get(d) ?? [];
          const inMonth = d.startsWith(month);
          if (!inMonth && items.length === 0) return <div key={d} className="hidden min-h-24 border-b border-r bg-muted/30 p-1.5 sm:block" aria-hidden="true" />;
          return (
            <section key={d} className={cn("min-h-24 border-b border-r p-1.5", !inMonth && "bg-muted/30 text-muted-foreground", d === todayKey && "bg-primary/5")}>
              <button type="button" onClick={() => onDay(d)} className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium hover:bg-muted", d === todayKey && "bg-primary text-primary-foreground")}>
                {Number(d.slice(8, 10))}
              </button>
              <span className="ml-1 text-xs capitalize sm:hidden">{fmtDayShort(d).split(" ")[0]}</span>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((o) => (
                  <Chip key={o.id} o={o} tz={tz} onSelect={onSelect} compact />
                ))}
                {items.length > 3 && (
                  <button type="button" onClick={() => onDay(d)} className="text-xs text-muted-foreground hover:underline">
                    +{items.length - 3} autres
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
