"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, List, MapPin, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { CalendarScene } from "@/components/illustrations";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormMessage } from "@/components/shared/form-message";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { CategoryOption } from "@/modules/events/application/categories";
import { MILESTONE_TEMPLATES, milestoneTemplateLabel } from "@/modules/events/domain/suggestions";
import type { EventType } from "@/modules/events/domain/event-types";

export type MilestoneItem = { id: string; title: string; description: string | null; startsAt: string; endsAt: string | null; location: string | null; categorySlugs: string[] };
type Actions = {
  create: (eventId: string, input: unknown) => Promise<ActionResult<{ id: string }>>;
  update: (eventId: string, milestoneId: string, input: unknown) => Promise<ActionResult>;
  remove: (eventId: string, milestoneId: string) => Promise<ActionResult>;
  /** Creates the classic moments of the event type (existing titles are skipped). */
  addSuggested?: (eventId: string) => Promise<ActionResult<{ created: number }>>;
};

function localParts(iso: string, timeZone: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function Timeline({ eventId, eventType, eventDate, timezone, milestones, categories, canManage, memberCategory, actions }: { eventId: string; eventType: EventType; eventDate: string | null; timezone: string; milestones: MilestoneItem[]; categories: CategoryOption[]; canManage: boolean; memberCategory: string | null; actions: Actions }) {
  const router = useRouter();
  const [pendingSuggest, startSuggest] = useTransition();
  const existingTitles = useMemo(() => new Set(milestones.map((m) => m.title.trim().toLowerCase())), [milestones]);
  const missingTemplates = MILESTONE_TEMPLATES[eventType].filter((t) => !existingTitles.has(t.title.toLowerCase())).length;
  function addSuggested() {
    if (!actions.addSuggested) return;
    startSuggest(async () => {
      const res = await actions.addSuggested!(eventId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.data.created ? `${res.data.created} étape${res.data.created > 1 ? "s" : ""} ajoutée${res.data.created > 1 ? "s" : ""} au planning.` : "Ces moments sont déjà dans le planning.");
        router.refresh();
      }
    });
  }
  const suggestChip = canManage && actions.addSuggested && missingTemplates > 0 && eventDate && (
    <Button variant="outline" size="sm" onClick={addSuggested} disabled={pendingSuggest} data-testid="add-suggested-milestones">
      <Sparkles className="size-3.5" aria-hidden="true" />
      {milestoneTemplateLabel(eventType)}
    </Button>
  );
  const [view, setView] = useState<"list" | "timeline">("timeline");
  const [editing, setEditing] = useState<MilestoneItem | "new" | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const catName = useMemo(() => new Map(categories.map((c) => [c.slug, c.name])), [categories]);
  const shown = useMemo(() => (onlyMine && memberCategory ? milestones.filter((m) => m.categorySlugs.length === 0 || m.categorySlugs.includes(memberCategory)) : milestones), [milestones, onlyMine, memberCategory]);
  const byDay = useMemo(() => {
    const map = new Map<string, MilestoneItem[]>();
    for (const m of shown) {
      const { date } = localParts(m.startsAt, timezone);
      map.set(date, [...(map.get(date) ?? []), m]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [shown, timezone]);

  const fmtDay = (d: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${d}T12:00:00Z`));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Affichage">
          <button type="button" role="tab" aria-selected={view === "timeline"} onClick={() => setView("timeline")} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium", view === "timeline" ? "bg-background shadow-sm" : "text-muted-foreground")}>
            <Clock className="size-3.5" aria-hidden="true" /> Chronologie
          </button>
          <button type="button" role="tab" aria-selected={view === "list"} onClick={() => setView("list")} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium", view === "list" ? "bg-background shadow-sm" : "text-muted-foreground")}>
            <List className="size-3.5" aria-hidden="true" /> Liste
          </button>
        </div>
        <div className="flex items-center gap-3">
          {memberCategory && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyMine} onCheckedChange={(v) => setOnlyMine(Boolean(v))} />
              Mes étapes seulement
            </label>
          )}
          {milestones.length > 0 && suggestChip}
          {canManage && milestones.length > 0 && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden="true" />
              Ajouter une étape
            </Button>
          )}
        </div>
      </div>

      {milestones.length === 0 ? (
        <IllustratedEmpty
          scene={CalendarScene}
          title="Le déroulé du jour J reste à écrire"
          description={canManage ? "Heure par heure : qui fait quoi, où, et quels prestataires sont concernés. Chaque étape ajoutée prévient automatiquement les professionnels de son métier." : "L'organisateur n'a pas encore partagé le déroulé de la journée."}
          example="Goûter des enfants — 16:30 → 17:15, la grange (garde d'enfants, traiteur)"
          action={canManage ? <>{suggestChip}<Button onClick={() => setEditing("new")}><Plus className="size-4" aria-hidden="true" />Ajouter une étape</Button></> : undefined}
          testId="planning-empty"
        />
      ) : shown.length === 0 ? (
        <IllustratedEmpty scene={CalendarScene} compact title="Aucune étape ne concerne votre métier" description="Décochez « Mes étapes seulement » pour voir tout le déroulé." action={<Button variant="outline" size="sm" onClick={() => setOnlyMine(false)}>Voir tout le planning</Button>} />
      ) : (
        byDay.map(([day, list]) => (
          <section key={day} aria-labelledby={`day-${day}`} className="space-y-3">
            <h2 id={`day-${day}`} className="text-sm font-semibold tracking-wide text-muted-foreground uppercase first-letter:uppercase">
              {fmtDay(day)}
              {eventDate === day && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary normal-case">Jour J</span>}
            </h2>
            {view === "timeline" ? (
              <ol className="relative ml-3 border-l-2 border-primary/30 pl-6">
                {list.map((m) => {
                  const s = localParts(m.startsAt, timezone);
                  const e = m.endsAt ? localParts(m.endsAt, timezone) : null;
                  return (
                    <li key={m.id} className="relative pb-6 last:pb-0">
                      <span className="absolute top-1.5 -left-[31px] size-3 rounded-full border-2 border-background bg-primary" aria-hidden="true" />
                      <div className="rounded-xl border bg-card p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold tabular-nums text-primary">
                              {s.time}
                              {e ? ` – ${e.time}` : ""}
                            </p>
                            <h3 className="font-medium">{m.title}</h3>
                          </div>
                          {canManage && <RowActions m={m} eventId={eventId} onEdit={() => setEditing(m)} actions={actions} />}
                        </div>
                        {m.description && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{m.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {m.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" aria-hidden="true" />
                              {m.location}
                            </span>
                          )}
                          {m.categorySlugs.map((slug) => (
                            <StatusBadge key={slug} tone="neutral" dot={false}>
                              {catName.get(slug) ?? slug}
                            </StatusBadge>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <ul className="divide-y rounded-2xl border bg-card">
                {list.map((m) => {
                  const s = localParts(m.startsAt, timezone);
                  const e = m.endsAt ? localParts(m.endsAt, timezone) : null;
                  return (
                    <li key={m.id} className="flex items-center gap-4 px-4 py-3">
                      <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-primary">
                        {s.time}
                        {e ? `–${e.time}` : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{m.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[m.location, ...m.categorySlugs.map((c) => catName.get(c) ?? c)].filter(Boolean).join(" · ")}</span>
                      </span>
                      {canManage && <RowActions m={m} eventId={eventId} onEdit={() => setEditing(m)} actions={actions} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))
      )}

      <MilestoneDialog eventId={eventId} eventDate={eventDate} timezone={timezone} item={editing} categories={categories} onClose={() => setEditing(null)} actions={actions} onSaved={() => router.refresh()} />
    </div>
  );
}

function RowActions({ m, eventId, onEdit, actions }: { m: MilestoneItem; eventId: string; onEdit: () => void; actions: Actions }) {
  const router = useRouter();
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Modifier « ${m.title} »`}>
        <Pencil className="size-3.5" aria-hidden="true" />
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Supprimer « ${m.title} »`}>
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        }
        title="Supprimer cette étape ?"
        description="Les prestataires concernés seront informés du changement de planning."
        confirmLabel="Supprimer"
        successMessage="Étape supprimée."
        onConfirm={async () => {
          const res = await actions.remove(eventId, m.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </div>
  );
}

function MilestoneDialog({ eventId, eventDate, timezone, item, categories, onClose, actions, onSaved }: { eventId: string; eventDate: string | null; timezone: string; item: MilestoneItem | "new" | null; categories: CategoryOption[]; onClose: () => void; actions: Actions; onSaved: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const m = item === "new" ? null : item;
  const start_ = m ? localParts(m.startsAt, timezone) : null;
  const end_ = m?.endsAt ? localParts(m.endsAt, timezone) : null;
  const [slugs, setSlugs] = useState<string[]>([]);
  const [slugsFor, setSlugsFor] = useState<string | null>(null);
  const key = m?.id ?? (item === "new" ? "new" : null);
  if (key !== slugsFor) {
    setSlugsFor(key);
    setSlugs(m?.categorySlugs ?? []);
  }
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? "") || null,
      date: String(fd.get("date") ?? ""),
      startTime: String(fd.get("startTime") ?? ""),
      endTime: String(fd.get("endTime") ?? "") || null,
      location: String(fd.get("location") ?? "") || null,
      categorySlugs: slugs,
    };
    start(async () => {
      const res = m ? await actions.update(eventId, m.id, input) : await actions.create(eventId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      toast.success(m ? "Étape mise à jour." : "Étape ajoutée.");
      onClose();
      onSaved();
    });
  }
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{m ? "Modifier l'étape" : "Nouvelle étape"}</DialogTitle>
          <DialogDescription>Heures exprimées dans le fuseau de l'évènement ({timezone}).</DialogDescription>
        </DialogHeader>
        <form key={key ?? "closed"} onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-title">Titre</Label>
            <Input id="m-title" name="title" defaultValue={m?.title ?? ""} required minLength={2} maxLength={160} autoFocus placeholder="Cérémonie, cocktail, goûter des enfants…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-date">Date</Label>
              <Input id="m-date" name="date" type="date" defaultValue={start_?.date ?? eventDate ?? ""} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-start">Début</Label>
              <Input id="m-start" name="startTime" type="time" defaultValue={start_?.time ?? ""} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-end">Fin (optionnel)</Label>
              <Input id="m-end" name="endTime" type="time" defaultValue={end_?.time ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-location">Lieu précis</Label>
            <Input id="m-location" name="location" defaultValue={m?.location ?? ""} maxLength={160} placeholder="Chapelle, terrasse, salle des enfants…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Détails</Label>
            <Textarea id="m-desc" name="description" defaultValue={m?.description ?? ""} rows={3} maxLength={2000} placeholder="Par exemple : pointage à l'arrivée, remise des consignes des parents à l'équipe." />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Prestataires concernés</legend>
            <p className="text-xs text-muted-foreground">Aucune coche = toute l'équipe est concernée.</p>
            <div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
              {categories.map((c) => (
                <label key={c.slug} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={slugs.includes(c.slug)} onCheckedChange={(v) => setSlugs((s) => (v ? [...s, c.slug] : s.filter((x) => x !== c.slug)))} />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <FormMessage error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? "Enregistrement…" : m ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
