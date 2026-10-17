"use client";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { ENTRY_KINDS, ENTRY_KIND_LABELS } from "@/modules/calendar/domain/constants";
import { ActionDialog } from "@/components/childcare/action-form";

export type EntryFormInitial = {
  id?: string;
  title?: string;
  description?: string | null;
  location?: string | null;
  kind?: string;
  startsAtLocal?: string; // YYYY-MM-DDTHH:mm in the user's zone
  endsAtLocal?: string;
  allDay?: boolean;
  rrule?: string | null;
  reminderMinutesBefore?: number | null;
  professionalId?: string | null;
};

const RRULE_PRESETS: Array<{ value: string; label: string }> = [
  { value: "none", label: "Jamais" },
  { value: "FREQ=DAILY", label: "Tous les jours" },
  { value: "FREQ=WEEKLY", label: "Toutes les semaines" },
  { value: "FREQ=WEEKLY;INTERVAL=2", label: "Toutes les deux semaines" },
  { value: "FREQ=MONTHLY", label: "Tous les mois" },
  { value: "custom", label: "Règle personnalisée (RRULE)" },
];

const REMINDERS: Array<{ value: string; label: string }> = [
  { value: "none", label: "Aucun" },
  { value: "15", label: "15 minutes avant" },
  { value: "60", label: "1 heure avant" },
  { value: "1440", label: "1 jour avant" },
  { value: "2880", label: "2 jours avant" },
  { value: "10080", label: "1 semaine avant" },
];

/** Create / edit dialog for a calendar entry. Dates are posted as local wall-clock + timezone. */
export function EntryDialog({
  trigger,
  initial,
  timezone,
  professionals,
  action,
  title,
}: {
  trigger: React.ReactNode;
  initial?: EntryFormInitial;
  timezone: string;
  professionals: Array<{ id: string; displayName: string }>;
  action: (fd: FormData) => Promise<ActionResult<unknown>>;
  title?: string;
}) {
  const presetMatch = initial?.rrule ? RRULE_PRESETS.find((p) => p.value === initial.rrule)?.value ?? "custom" : "none";
  const [preset, setPreset] = useState(presetMatch);
  const [allDay, setAllDay] = useState(Boolean(initial?.allDay));
  const isEdit = Boolean(initial?.id);
  return (
    <ActionDialog trigger={trigger} title={title ?? (isEdit ? "Modifier l'entrée" : "Nouvelle entrée")} action={action} submitLabel={isEdit ? "Enregistrer" : "Créer"} successMessage={isEdit ? "Entrée mise à jour." : "Entrée créée."}>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="timezone" value={timezone} />
          <div className="space-y-1.5">
            <Label htmlFor="e-title">Titre *</Label>
            <Input id="e-title" name="title" required maxLength={200} defaultValue={initial?.title ?? ""} aria-invalid={Boolean(fieldErrors.title)} />
            {fieldErrors.title && <p className="text-xs text-destructive">{fieldErrors.title[0]}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-kind">Type</Label>
              <select id="e-kind" name="kind" defaultValue={initial?.kind ?? "other"} className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                {ENTRY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ENTRY_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-pro">Fiche professionnelle</Label>
              <select id="e-pro" name="professionalId" defaultValue={initial?.professionalId ?? "none"} className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                <option value="none">Aucune (agenda personnel)</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="allDay" checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} /> Journée entière
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-start">Début *</Label>
              <Input id="e-start" name="startsAt" type={allDay ? "date" : "datetime-local"} required defaultValue={allDay ? initial?.startsAtLocal?.slice(0, 10) : initial?.startsAtLocal} aria-invalid={Boolean(fieldErrors.startsAt)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-end">Fin *</Label>
              <Input id="e-end" name="endsAt" type={allDay ? "date" : "datetime-local"} required={!allDay} defaultValue={allDay ? initial?.endsAtLocal?.slice(0, 10) : initial?.endsAtLocal} aria-invalid={Boolean(fieldErrors.endsAt)} />
              {fieldErrors.endsAt && <p className="text-xs text-destructive">{fieldErrors.endsAt[0]}</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-rrule-preset">Répétition</Label>
              <select id="e-rrule-preset" name="rrulePreset" value={preset} onChange={(e) => setPreset(e.target.value)} className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                {RRULE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-reminder">Rappel</Label>
              <select id="e-reminder" name="reminderMinutesBefore" defaultValue={initial?.reminderMinutesBefore != null ? String(initial.reminderMinutesBefore) : "none"} className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                {REMINDERS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {preset === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="e-rrule">Règle RRULE</Label>
              <Input id="e-rrule" name="rrule" placeholder="FREQ=WEEKLY;BYDAY=MO;UNTIL=20271231T235959Z" defaultValue={initial?.rrule ?? ""} aria-invalid={Boolean(fieldErrors.rrule)} />
              <p className="text-xs text-muted-foreground">FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, BYDAY, BYMONTHDAY, COUNT, UNTIL.</p>
              {fieldErrors.rrule && <p className="text-xs text-destructive">{fieldErrors.rrule[0]}</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="e-location">Lieu</Label>
            <Input id="e-location" name="location" maxLength={300} defaultValue={initial?.location ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-desc">Description</Label>
            <Textarea id="e-desc" name="description" rows={3} maxLength={5000} defaultValue={initial?.description ?? ""} />
          </div>
        </>
      )}
    </ActionDialog>
  );
}
