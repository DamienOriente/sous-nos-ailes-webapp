"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { CreateEventInput } from "@/modules/events/application/event-service";
import { suggestedEventName } from "@/modules/events/domain/event-naming";
import { EVENT_TYPE_LABELS, EVENT_TYPES, type EventType } from "@/modules/events/domain/event-types";

export type CategoryOption = { slug: string; name: string; group: string; isChildcare: boolean };

type Props = {
  categories: CategoryOption[];
  firstName: string;
  mode: "onboarding" | "create";
  action: (input: CreateEventInput) => Promise<ActionResult<{ id: string }>>;
};

const STEPS = ["Type", "Date & lieu", "Invités & budget", "Prestataires"] as const;

const DEFAULT_WANTED: Record<EventType, string[]> = {
  wedding: ["garde-enfants-evenementielle", "domaine-reception", "traiteur", "photographe", "dj"],
  baptism: ["garde-enfants-evenementielle", "traiteur", "photographe"],
  birthday: ["animation-enfants", "patissier"],
  seminar: ["salle-evenementielle", "traiteur", "animateur"],
  corporate: ["salle-evenementielle", "traiteur", "garde-enfants-evenementielle"],
  family_gathering: ["garde-enfants-evenementielle", "traiteur"],
  other: [],
};

/** Progressive form shared by the organiser onboarding and "new event". Validation errors come from the server (Zod) and are shown globally. */
export function EventForm({ categories, firstName, mode, action }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<EventType>("wedding");
  const [who, setWho] = useState("");
  const [name, setName] = useState(suggestedEventName("wedding", firstName));
  const [nameTouched, setNameTouched] = useState(false);
  const [dateKnown, setDateKnown] = useState(true);
  const [eventDate, setEventDate] = useState("");
  const [tentative, setTentative] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [venueName, setVenueName] = useState("");
  const [guests, setGuests] = useState("");
  const [children, setChildren] = useState("");
  const [budget, setBudget] = useState("");
  const [wanted, setWanted] = useState<string[]>(DEFAULT_WANTED.wedding);
  const [preferences, setPreferences] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, CategoryOption[]>();
    for (const c of categories) map.set(c.group, [...(map.get(c.group) ?? []), c]);
    return [...map.entries()];
  }, [categories]);

  function pickType(t: EventType) {
    setType(t);
    if (!nameTouched) setName(suggestedEventName(t, firstName, who));
    setWanted(DEFAULT_WANTED[t].filter((slug) => categories.some((c) => c.slug === slug)));
  }
  function changeWho(v: string) {
    setWho(v);
    if (!nameTouched) setName(suggestedEventName(type, firstName, v));
  }

  function validateStep(): string | null {
    if (step === 0 && name.trim().length < 2) return "Donnez un nom à votre évènement.";
    if (step === 1 && dateKnown && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return "Indiquez la date prévue ou cochez « pas encore fixée ».";
    if (step === 1 && postalCode && !/^\d{5}$/.test(postalCode)) return "Le code postal doit comporter 5 chiffres.";
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) return setError(err);
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function submit() {
    const err = validateStep();
    if (err) return setError(err);
    setError(null);
    const toInt = (v: string) => (v.trim() === "" ? null : Number.parseInt(v, 10));
    const input: CreateEventInput = {
      type,
      name: name.trim(),
      eventDate: dateKnown ? eventDate : null,
      dateIsTentative: dateKnown ? tentative : true,
      startTime: dateKnown && startTime ? startTime : null,
      endTime: null,
      city: city.trim() || null,
      postalCode: postalCode.trim() || null,
      venueName: venueName.trim() || null,
      addressLine1: null,
      expectedGuests: toInt(guests),
      expectedChildren: toInt(children),
      budgetCents: budget.trim() === "" ? null : Math.round(Number.parseFloat(budget.replace(",", ".")) * 100),
      wantedCategorySlugs: wanted,
      preferences: preferences.trim() || null,
      description: null,
      timezone: "Europe/Paris",
    };
    start(async () => {
      const res = await action(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Votre espace évènement est prêt.");
      router.push(`/app/evenements/${res.data.id}?nouveau=1`);
    });
  }

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-2 text-xs" aria-label="Étapes">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn("flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold", i < step ? "border-primary bg-primary text-primary-foreground" : i === step ? "border-primary text-primary" : "text-muted-foreground")}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="size-3" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("hidden sm:inline", i === step ? "font-medium" : "text-muted-foreground")}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-border sm:w-8" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <form
        className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) next();
          else submit();
        }}
      >
        {step === 0 && (
          <fieldset className="space-y-5">
            <legend className="text-lg font-semibold">Quel évènement préparez-vous ?</legend>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Type d'évènement">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => pickType(t)}
                  className={cn("rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/60", type === t && "border-primary bg-accent/50 ring-1 ring-primary")}
                >
                  {EVENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            {(type === "wedding" || type === "baptism" || type === "birthday" || type === "seminar" || type === "corporate" || type === "family_gathering") && (
              <div className="space-y-1.5">
                <Label htmlFor="who">{type === "wedding" ? "Prénom de votre partenaire" : type === "baptism" || type === "birthday" ? "Prénom de l'enfant ou de la personne fêtée" : "Nom de l'entreprise ou de la famille"}</Label>
                <Input id="who" value={who} onChange={(e) => changeWho(e.target.value)} placeholder={type === "wedding" ? "Lisa" : ""} autoComplete="off" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom de l'évènement</Label>
              <Input
                id="name"
                value={name}
                required
                maxLength={120}
                onChange={(e) => {
                  setNameTouched(true);
                  setName(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">Proposé automatiquement, modifiable à tout moment.</p>
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset className="space-y-5">
            <legend className="text-lg font-semibold">Quand et où ?</legend>
            <div className="flex items-center gap-2">
              <Checkbox id="date-unknown" checked={!dateKnown} onCheckedChange={(v) => setDateKnown(!v)} />
              <Label htmlFor="date-unknown">La date n'est pas encore fixée</Label>
            </div>
            {dateKnown && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="eventDate">Date prévue</Label>
                  <Input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="startTime">Heure de début (optionnel)</Label>
                  <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Checkbox id="tentative" checked={tentative} onCheckedChange={(v) => setTentative(Boolean(v))} />
                  <Label htmlFor="tentative">Date provisoire</Label>
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Toulouse" autoComplete="address-level2" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} inputMode="numeric" maxLength={5} placeholder="31000" autoComplete="postal-code" />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="venueName">Lieu (si connu)</Label>
                <Input id="venueName" value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Domaine, salle, mairie…" />
              </div>
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="space-y-5">
            <legend className="text-lg font-semibold">Combien de personnes ?</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="guests">Invités (approx.)</Label>
                <Input id="guests" type="number" min={0} inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="80" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="children">Enfants (approx.)</Label>
                <Input id="children" type="number" min={0} inputMode="numeric" value={children} onChange={(e) => setChildren(e.target.value)} placeholder="12" />
                <p className="text-xs text-muted-foreground">Pour dimensionner la garde d'enfants.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget">Budget indicatif (€, optionnel)</Label>
                <Input id="budget" type="number" min={0} step="100" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="15000" />
              </div>
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset className="space-y-5">
            <legend className="text-lg font-semibold">Quels professionnels recherchez-vous ?</legend>
            <p className="text-sm text-muted-foreground">Nous créerons une ligne de budget et une place dans votre équipe pour chaque catégorie cochée.</p>
            <div className="space-y-4">
              {grouped.map(([group, list]) => (
                <div key={group}>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((c) => {
                      const checked = wanted.includes(c.slug);
                      return (
                        <label key={c.slug} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/60", checked && "border-primary bg-accent/40")}>
                          <Checkbox checked={checked} onCheckedChange={(v) => setWanted((w) => (v ? [...w, c.slug] : w.filter((s) => s !== c.slug)))} aria-label={c.name} />
                          <span>{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferences">Vos préférences (optionnel)</Label>
              <Textarea id="preferences" value={preferences} onChange={(e) => setPreferences(e.target.value)} maxLength={2000} placeholder="Ambiance, contraintes, souhaits particuliers pour les enfants…" rows={3} />
            </div>
          </fieldset>
        )}

        <FormMessage error={error} />

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Retour
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="submit">
              Continuer
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? "Création…" : mode === "onboarding" ? "Créer mon espace" : "Créer l'évènement"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
