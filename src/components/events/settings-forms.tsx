"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormMessage } from "@/components/shared/form-message";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { EVENT_STATUS_TONES, nextEventStatuses, type EventStatus } from "@/modules/events/domain/event-status";
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, EVENT_TYPES, type EventType } from "@/modules/events/domain/event-types";

export type SettingsValue = {
  name: string;
  type: EventType;
  description: string | null;
  eventDate: string | null;
  dateIsTentative: boolean;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  venueName: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  expectedGuests: number | null;
  expectedChildren: number | null;
  budgetCents: number | null;
  preferences: string | null;
};

const TIMEZONES = ["Europe/Paris", "Europe/Brussels", "Europe/Zurich", "Europe/Luxembourg", "America/Martinique", "America/Guadeloupe", "Indian/Reunion", "America/Cayenne", "Pacific/Noumea", "Pacific/Tahiti"];

export function EventSettingsForm({ eventId, value, action }: { eventId: string; value: SettingsValue; action: (eventId: string, input: unknown) => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<string>(value.type);
  const [tz, setTz] = useState(value.timezone);
  const [dateKnown, setDateKnown] = useState(Boolean(value.eventDate));
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => (String(fd.get(k) ?? "").trim() === "" ? null : Number.parseInt(String(fd.get(k)), 10));
    const budget = String(fd.get("budget") ?? "").trim();
    const input = {
      name: fd.get("name"),
      type,
      description: String(fd.get("description") ?? "") || null,
      eventDate: dateKnown ? String(fd.get("eventDate") ?? "") || null : null,
      dateIsTentative: Boolean(fd.get("dateIsTentative")),
      startTime: dateKnown ? String(fd.get("startTime") ?? "") || null : null,
      endTime: dateKnown ? String(fd.get("endTime") ?? "") || null : null,
      timezone: tz,
      venueName: String(fd.get("venueName") ?? "") || null,
      addressLine1: String(fd.get("addressLine1") ?? "") || null,
      postalCode: String(fd.get("postalCode") ?? "") || null,
      city: String(fd.get("city") ?? "") || null,
      expectedGuests: num("expectedGuests"),
      expectedChildren: num("expectedChildren"),
      budgetCents: budget === "" ? null : Math.round(Number.parseFloat(budget.replace(",", ".")) * 100),
      preferences: String(fd.get("preferences") ?? "") || null,
    };
    start(async () => {
      const res = await action(eventId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      toast.success("Évènement mis à jour.");
      router.refresh();
    });
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="s-name">Nom</Label>
          <Input id="s-name" name="name" defaultValue={value.name} required minLength={2} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-type">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="s-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {EVENT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-tz">Fuseau horaire</Label>
          <Select value={tz} onValueChange={setTz}>
            <SelectTrigger id="s-tz">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox id="s-date-unknown" checked={!dateKnown} onCheckedChange={(v) => setDateKnown(!v)} />
          <Label htmlFor="s-date-unknown">La date n'est pas encore fixée</Label>
        </div>
        {dateKnown && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="s-date">Date</Label>
              <Input id="s-date" name="eventDate" type="date" defaultValue={value.eventDate ?? ""} required />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox id="s-tentative" name="dateIsTentative" defaultChecked={value.dateIsTentative} />
              <Label htmlFor="s-tentative">Date provisoire</Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-start">Heure de début</Label>
              <Input id="s-start" name="startTime" type="time" defaultValue={value.startTime ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-end">Heure de fin</Label>
              <Input id="s-end" name="endTime" type="time" defaultValue={value.endTime ?? ""} />
            </div>
          </>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="s-venue">Lieu</Label>
          <Input id="s-venue" name="venueName" defaultValue={value.venueName ?? ""} maxLength={160} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="s-address">Adresse</Label>
          <Input id="s-address" name="addressLine1" defaultValue={value.addressLine1 ?? ""} maxLength={200} autoComplete="street-address" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-postal">Code postal</Label>
          <Input id="s-postal" name="postalCode" defaultValue={value.postalCode ?? ""} inputMode="numeric" maxLength={5} autoComplete="postal-code" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-city">Ville</Label>
          <Input id="s-city" name="city" defaultValue={value.city ?? ""} maxLength={120} autoComplete="address-level2" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-guests">Invités attendus</Label>
          <Input id="s-guests" name="expectedGuests" type="number" min={0} defaultValue={value.expectedGuests ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-children">Enfants attendus</Label>
          <Input id="s-children" name="expectedChildren" type="number" min={0} defaultValue={value.expectedChildren ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-budget">Budget indicatif (€)</Label>
          <Input id="s-budget" name="budget" type="number" min={0} step="100" defaultValue={value.budgetCents !== null ? (value.budgetCents / 100).toString() : ""} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="s-desc">Description</Label>
          <Textarea id="s-desc" name="description" defaultValue={value.description ?? ""} rows={3} maxLength={4000} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="s-pref">Préférences</Label>
          <Textarea id="s-pref" name="preferences" defaultValue={value.preferences ?? ""} rows={2} maxLength={2000} />
        </div>
      </div>
      <FormMessage error={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

const STATUS_HINT: Record<EventStatus, string> = {
  planning: "Vous préparez l'évènement.",
  confirmed: "Date et lieu confirmés : les prestataires peuvent s'organiser.",
  in_progress: "C'est le jour J : l'équipe est sur le terrain.",
  completed: "L'évènement a eu lieu. Exportez ou conservez vos données.",
  cancelled: "L'évènement n'aura pas lieu.",
  archived: "Espace en lecture seule.",
};

export function EventStatusPanel({ eventId, status, canArchive, action }: { eventId: string; status: EventStatus; canArchive: boolean; action: (eventId: string, to: EventStatus, reason?: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = nextEventStatuses(status).filter((s) => s !== "archived" || canArchive);
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm">
        <StatusBadge tone={EVENT_STATUS_TONES[status]}>{EVENT_STATUS_LABELS[status]}</StatusBadge>
        <span className="text-muted-foreground">{STATUS_HINT[status]}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {next.map((to) =>
          to === "cancelled" || to === "archived" ? (
            <ConfirmDialog
              key={to}
              trigger={
                <Button variant="destructive" size="sm">
                  {to === "cancelled" ? "Annuler l'évènement" : "Archiver"}
                </Button>
              }
              title={to === "cancelled" ? "Annuler l'évènement ?" : "Archiver l'évènement ?"}
              description={to === "cancelled" ? "Les membres garderont la lecture de l'espace ; les prestataires confirmés devront être prévenus." : "L'espace passe en lecture seule et quitte la liste des évènements actifs."}
              confirmLabel="Confirmer"
              onConfirm={async () => {
                const res = await action(eventId, to);
                if (res.ok) router.refresh();
                return res;
              }}
            />
          ) : (
            <Button
              key={to}
              size="sm"
              variant={to === "completed" ? "default" : "outline"}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await action(eventId, to);
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success(`Statut : ${EVENT_STATUS_LABELS[to]}.`);
                    router.refresh();
                  }
                })
              }
            >
              {to === "planning" ? "Repasser en préparation" : to === "confirmed" ? "Marquer confirmé" : to === "in_progress" ? "Démarrer (jour J)" : "Marquer terminé"}
            </Button>
          ),
        )}
      </div>
    </div>
  );
}

export function DeleteEventPanel({ eventId, eventName, action }: { eventId: string; eventName: string; action: (eventId: string, confirmName: string) => Promise<ActionResult> }) {
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ok = typed.trim() === eventName;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        start(async () => {
          const res = await action(eventId, typed);
          if (res && !res.ok) setError(res.error);
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="del-name">
          Tapez le nom exact de l'évènement : <strong>{eventName}</strong>
        </Label>
        <Input id="del-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </div>
      <FormMessage error={error} />
      <Button type="submit" variant="destructive" disabled={!ok || pending}>
        {pending ? "Suppression…" : "Supprimer définitivement l'accès à cet évènement"}
      </Button>
    </form>
  );
}
