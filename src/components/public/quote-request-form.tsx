"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitQuoteRequest } from "@/server/actions/requests";
import { idleState } from "@/server/action-state";
import { EVENT_REQUEST_STEPS } from "@/validation/event-request";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input, RadioOption, Select, Textarea } from "@/components/ui/field";
import { AGE_GROUP_LABELS, EVENT_TYPE_LABELS, TRI_STATE_LABELS } from "@/domain/labels";
import { cn } from "@/lib/cn";

type VenueOption = { id: string; name: string; city: string; slug: string };
type ServiceOptionItem = { code: string; label: string; description: string | null };

type Values = {
  eventType: string;
  dateMode: "FIXED" | "FLEXIBLE";
  eventDate: string;
  eventEndDate: string;
  dateNote: string;
  startTime: string;
  endTime: string;
  venueMode: "PARTNER" | "FREE";
  venueId: string;
  venueName: string;
  city: string;
  postalCode: string;
  childrenUnder3: string;
  children3to5: string;
  children6to10: string;
  children11plus: string;
  parentsOnSite: string;
  dedicatedSpace: string;
  optionCodes: string[];
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  organizerRole: string;
  message: string;
  privacyAccepted: boolean;
  marketingOptIn: boolean;
};

const STEP_IDS = EVENT_REQUEST_STEPS.map((s) => s.id);
type StepId = (typeof STEP_IDS)[number];

function stepOfField(field: string): StepId {
  const step = EVENT_REQUEST_STEPS.find((s) => (s.fields as readonly string[]).includes(field));
  return step?.id ?? "summary";
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
      {pending ? "Envoi en cours…" : "Envoyer ma demande"}
    </Button>
  );
}

export function QuoteRequestForm({ venues, options, preselectedVenue, referralCode }: { venues: VenueOption[]; options: ServiceOptionItem[]; preselectedVenue: VenueOption | null; referralCode: string | null }) {
  const [state, action] = useActionState(submitQuoteRequest, idleState);
  const [stepIndex, setStepIndex] = useState(0);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [submissionKey] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  const [startedAt] = useState(() => Date.now());
  const [values, setValues] = useState<Values>({
    eventType: "WEDDING",
    dateMode: "FIXED",
    eventDate: "",
    eventEndDate: "",
    dateNote: "",
    startTime: "",
    endTime: "",
    venueMode: preselectedVenue ? "PARTNER" : venues.length ? "PARTNER" : "FREE",
    venueId: preselectedVenue?.id ?? "",
    venueName: "",
    city: preselectedVenue?.city ?? "",
    postalCode: "",
    childrenUnder3: "0",
    children3to5: "0",
    children6to10: "0",
    children11plus: "0",
    parentsOnSite: "YES",
    dedicatedSpace: "UNKNOWN",
    optionCodes: [],
    organizerName: "",
    organizerEmail: "",
    organizerPhone: "",
    organizerRole: "",
    message: "",
    privacyAccepted: false,
    marketingOptIn: false,
  });

  const serverErrors = useMemo(() => state.fieldErrors ?? {}, [state.fieldErrors]);

  // Jump to the first step that carries a server-side error (state adjusted during render, once per action result).
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "error") {
      const fields = Object.keys(serverErrors).filter((f) => f !== "_form");
      const indices = fields.map((f) => STEP_IDS.indexOf(stepOfField(f))).filter((i) => i >= 0);
      if (indices.length) setStepIndex(Math.min(...indices));
    }
  }

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));
  const errorFor = (field: string): string[] | undefined => {
    if (localErrors[field]) return [localErrors[field]];
    return serverErrors[field];
  };

  const totalChildren = ["childrenUnder3", "children3to5", "children6to10", "children11plus"].reduce((sum, key) => sum + (Number(values[key as keyof Values]) || 0), 0);
  const under3 = Number(values.childrenUnder3) || 0;

  function validateStep(id: StepId): boolean {
    const errors: Record<string, string> = {};
    if (id === "event") {
      if (values.dateMode === "FIXED") {
        if (!values.eventDate) errors.eventDate = "Indiquez la date, ou choisissez « date encore incertaine ».";
        if (!values.startTime) errors.startTime = "Indiquez l’heure de début de la garde.";
        if (!values.endTime) errors.endTime = "Indiquez l’heure de fin de la garde.";
      } else if (!values.dateNote && !values.eventDate) {
        errors.dateNote = "Donnez-nous une indication de période.";
      }
    }
    if (id === "place") {
      if (values.venueMode === "PARTNER" && !values.venueId) errors.venueId = "Choisissez un lieu partenaire ou passez en lieu libre.";
      if (values.venueMode === "FREE" && !values.venueName.trim()) errors.venueName = "Indiquez le nom ou le type de lieu.";
      if (!values.city.trim()) errors.city = "Indiquez la commune.";
      if (!/^\d{5}$/.test(values.postalCode.trim())) errors.postalCode = "Code postal à 5 chiffres attendu.";
    }
    if (id === "children" && totalChildren < 1) errors.children3to5 = "Indiquez au moins un enfant à accueillir.";
    if (id === "contact") {
      if (!values.organizerName.trim()) errors.organizerName = "Indiquez votre nom.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.organizerEmail.trim())) errors.organizerEmail = "Adresse email invalide.";
      if (!values.privacyAccepted) errors.privacyAccepted = "Merci de prendre connaissance de la politique de confidentialité.";
    }
    setLocalErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const current = EVENT_REQUEST_STEPS[stepIndex];
  const goNext = () => {
    if (!validateStep(current.id)) return;
    setStepIndex((i) => Math.min(i + 1, EVENT_REQUEST_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goBack = () => {
    setLocalErrors({});
    setStepIndex((i) => Math.max(i - 1, 0));
  };
  const goTo = (id: StepId) => setStepIndex(STEP_IDS.indexOf(id));

  const selectedVenue = venues.find((v) => v.id === values.venueId) ?? null;
  const optionLabels = options.filter((o) => values.optionCodes.includes(o.code)).map((o) => o.label);

  return (
    <form action={action} noValidate className="flex flex-col gap-8">
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <input type="hidden" name="startedAt" value={startedAt} />
      {referralCode ? <input type="hidden" name="referral" value={referralCode} /> : null}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Site web</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Step indicator */}
      <ol className="flex flex-wrap gap-x-5 gap-y-2 border-b border-sage-200 pb-4 text-[13px] font-semibold" aria-label="Étapes du formulaire">
        {EVENT_REQUEST_STEPS.map((step, index) => {
          const done = index < stepIndex;
          const active = index === stepIndex;
          return (
            <li key={step.id} aria-current={active ? "step" : undefined} className={cn("flex items-center gap-2", active ? "text-clay-700" : done ? "text-sage-800" : "text-ink-300")}>
              <span aria-hidden="true" className={cn("size-2 rounded-full", active ? "bg-clay-500" : done ? "bg-sage-600" : "bg-ivory-400")} />
              <span>{step.title}</span>
              {done ? <span className="sr-only">(terminée)</span> : null}
            </li>
          );
        })}
      </ol>

      {state.status === "error" ? (
        <Alert kind="danger" role="alert">
          {state.message}
          {serverErrors._form ? ` ${serverErrors._form.join(" ")}` : ""}
        </Alert>
      ) : null}

      {/* Step 1: event */}
      <fieldset hidden={current.id !== "event"} className="flex flex-col gap-6">
        <legend className="font-display text-2xl">Votre événement</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(EVENT_TYPE_LABELS) as Array<keyof typeof EVENT_TYPE_LABELS>).map((type) => (
            <RadioOption key={type} id={`eventType-${type}`} name="eventType" value={type} checked={values.eventType === type} onChange={() => set("eventType", type)} label={EVENT_TYPE_LABELS[type]} />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <RadioOption id="dateMode-fixed" name="dateMode" value="FIXED" checked={values.dateMode === "FIXED"} onChange={() => set("dateMode", "FIXED")} label="La date est fixée" />
          <RadioOption id="dateMode-flexible" name="dateMode" value="FLEXIBLE" checked={values.dateMode === "FLEXIBLE"} onChange={() => set("dateMode", "FLEXIBLE")} label="La date est encore incertaine" description="Nous étudions quand même votre demande." />
        </div>
        {values.dateMode === "FIXED" ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Date de l’événement" htmlFor="eventDate" error={errorFor("eventDate")} required>
                <Input id="eventDate" name="eventDate" type="date" value={values.eventDate} onChange={(e) => set("eventDate", e.target.value)} invalid={Boolean(errorFor("eventDate"))} />
              </Field>
              <Field label="Date de fin" htmlFor="eventEndDate" error={errorFor("eventEndDate")} optionalLabel help="Seulement si l’événement dure plusieurs jours.">
                <Input id="eventEndDate" name="eventEndDate" type="date" value={values.eventEndDate} onChange={(e) => set("eventEndDate", e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Début de la garde" htmlFor="startTime" error={errorFor("startTime")} required>
                <Input id="startTime" name="startTime" type="time" value={values.startTime} onChange={(e) => set("startTime", e.target.value)} invalid={Boolean(errorFor("startTime"))} />
              </Field>
              <Field label="Fin de la garde" htmlFor="endTime" error={errorFor("endTime")} required help="Si la garde se termine après minuit, indiquez simplement l’heure (par exemple 01:00).">
                <Input id="endTime" name="endTime" type="time" value={values.endTime} onChange={(e) => set("endTime", e.target.value)} invalid={Boolean(errorFor("endTime"))} />
              </Field>
            </div>
          </>
        ) : (
          <>
            <Field label="Période envisagée" htmlFor="dateNote" error={errorFor("dateNote")} required help="Par exemple : « un samedi de juin 2027 », « l’été prochain ».">
              <Input id="dateNote" name="dateNote" value={values.dateNote} onChange={(e) => set("dateNote", e.target.value)} invalid={Boolean(errorFor("dateNote"))} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Date pressentie" htmlFor="eventDate-flex" optionalLabel>
                <Input id="eventDate-flex" name="eventDate" type="date" value={values.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
              </Field>
              <Field label="Début probable" htmlFor="startTime-flex" optionalLabel>
                <Input id="startTime-flex" name="startTime" type="time" value={values.startTime} onChange={(e) => set("startTime", e.target.value)} />
              </Field>
              <Field label="Fin probable" htmlFor="endTime-flex" optionalLabel>
                <Input id="endTime-flex" name="endTime" type="time" value={values.endTime} onChange={(e) => set("endTime", e.target.value)} />
              </Field>
            </div>
          </>
        )}
      </fieldset>

      {/* Step 2: place */}
      <fieldset hidden={current.id !== "place"} className="flex flex-col gap-6">
        <legend className="font-display text-2xl">Le lieu</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <RadioOption id="venueMode-partner" name="venueMode" value="PARTNER" checked={values.venueMode === "PARTNER"} onChange={() => set("venueMode", "PARTNER")} label="Un lieu partenaire" description={venues.length ? "Nous connaissons déjà ses espaces." : "Aucun lieu partenaire publié pour le moment."} disabled={!venues.length} />
          <RadioOption id="venueMode-free" name="venueMode" value="FREE" checked={values.venueMode === "FREE"} onChange={() => set("venueMode", "FREE")} label="Un autre lieu" description="Domaine, salle, restaurant, chez vous…" />
        </div>
        {values.venueMode === "PARTNER" ? (
          <Field label="Lieu partenaire" htmlFor="venueId" error={errorFor("venueId")} required>
            <Select
              id="venueId"
              name="venueId"
              value={values.venueId}
              invalid={Boolean(errorFor("venueId"))}
              onChange={(e) => {
                const venue = venues.find((v) => v.id === e.target.value);
                set("venueId", e.target.value);
                if (venue && !values.city) set("city", venue.city);
              }}
            >
              <option value="">Choisir un lieu…</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name} — {venue.city}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Nom ou type de lieu" htmlFor="venueName" error={errorFor("venueName")} required>
            <Input id="venueName" name="venueName" value={values.venueName} onChange={(e) => set("venueName", e.target.value)} invalid={Boolean(errorFor("venueName"))} />
          </Field>
        )}
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field label="Commune" htmlFor="city" error={errorFor("city")} required>
            <Input id="city" name="city" autoComplete="address-level2" value={values.city} onChange={(e) => set("city", e.target.value)} invalid={Boolean(errorFor("city"))} />
          </Field>
          <Field label="Code postal" htmlFor="postalCode" error={errorFor("postalCode")} required>
            <Input id="postalCode" name="postalCode" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={values.postalCode} onChange={(e) => set("postalCode", e.target.value)} invalid={Boolean(errorFor("postalCode"))} />
          </Field>
        </div>
      </fieldset>

      {/* Step 3: children */}
      <fieldset hidden={current.id !== "children"} className="flex flex-col gap-6">
        <legend className="font-display text-2xl">Les enfants</legend>
        <p className="text-[15px] leading-snug text-ink-500">Seul le nombre d’enfants par tranche d’âge nous est utile. Aucun nom, aucune date de naissance.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {(Object.keys(AGE_GROUP_LABELS) as Array<keyof typeof AGE_GROUP_LABELS>).map((key) => (
            <Field key={key} label={AGE_GROUP_LABELS[key]} htmlFor={key} error={errorFor(key)}>
              <Input id={key} name={key} type="number" min={0} max={200} inputMode="numeric" value={values[key]} onChange={(e) => set(key, e.target.value)} invalid={Boolean(errorFor(key))} />
            </Field>
          ))}
        </div>
        {under3 > 0 ? (
          <Alert kind="warning" title="Enfants de moins de 3 ans">
            Leur accueil fait l’objet d’une étude spécifique (espace de repos, horaires, présence des parents). Il n’est pas automatique : Marie vous dira ce qui est possible.
          </Alert>
        ) : null}
        <div>
          <p className="mb-2 text-[15px] font-semibold text-ink-900">Des parents seront-ils présents sur place ?</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["YES", "PARTIAL", "NO"] as const).map((v) => (
              <RadioOption key={v} id={`parentsOnSite-${v}`} name="parentsOnSite" value={v} checked={values.parentsOnSite === v} onChange={() => set("parentsOnSite", v)} label={TRI_STATE_LABELS[v]} />
            ))}
          </div>
          {values.parentsOnSite === "NO" ? <p className="mt-2 text-sm leading-snug text-ink-500">Sans parents sur place, nous organiserons avec vous la remise et la reprise des enfants.</p> : null}
        </div>
        <div>
          <p className="mb-2 text-[15px] font-semibold text-ink-900">Un espace est-il prévu pour les enfants ?</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["YES", "NO", "UNKNOWN"] as const).map((v) => (
              <RadioOption key={v} id={`dedicatedSpace-${v}`} name="dedicatedSpace" value={v} checked={values.dedicatedSpace === v} onChange={() => set("dedicatedSpace", v)} label={v === "UNKNOWN" ? "Je ne sais pas encore" : TRI_STATE_LABELS[v]} />
            ))}
          </div>
          {values.dedicatedSpace !== "YES" ? <p className="mt-2 text-sm leading-snug text-ink-500">Pas d’inquiétude : nous repérons l’espace avec vous ou avec le lieu.</p> : null}
        </div>
        {options.length ? (
          <div>
            <p className="mb-2 text-[15px] font-semibold text-ink-900">Options qui vous intéressent</p>
            <div className="grid gap-3">
              {options.map((option) => (
                <Checkbox
                  key={option.code}
                  id={`option-${option.code}`}
                  name="optionCodes[]"
                  value={option.code}
                  checked={values.optionCodes.includes(option.code)}
                  onChange={(e) => set("optionCodes", e.target.checked ? [...values.optionCodes, option.code] : values.optionCodes.filter((c) => c !== option.code))}
                  label={
                    <>
                      <span className="font-medium">{option.label}</span>
                      {option.description ? <span className="block text-sm text-ink-500">{option.description}</span> : null}
                    </>
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
      </fieldset>

      {/* Step 4: contact */}
      <fieldset hidden={current.id !== "contact"} className="flex flex-col gap-6">
        <legend className="font-display text-2xl">Vos coordonnées</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Votre nom" htmlFor="organizerName" error={errorFor("organizerName")} required>
            <Input id="organizerName" name="organizerName" autoComplete="name" value={values.organizerName} onChange={(e) => set("organizerName", e.target.value)} invalid={Boolean(errorFor("organizerName"))} />
          </Field>
          <Field label="Votre email" htmlFor="organizerEmail" error={errorFor("organizerEmail")} required help="Vous y recevrez l’accusé de réception et l’accès à votre espace.">
            <Input id="organizerEmail" name="organizerEmail" type="email" autoComplete="email" inputMode="email" value={values.organizerEmail} onChange={(e) => set("organizerEmail", e.target.value)} invalid={Boolean(errorFor("organizerEmail"))} />
          </Field>
          <Field label="Téléphone" htmlFor="organizerPhone" error={errorFor("organizerPhone")} optionalLabel help="Pour l’appel de qualification.">
            <Input id="organizerPhone" name="organizerPhone" type="tel" autoComplete="tel" inputMode="tel" value={values.organizerPhone} onChange={(e) => set("organizerPhone", e.target.value)} invalid={Boolean(errorFor("organizerPhone"))} />
          </Field>
          <Field label="Vous êtes" htmlFor="organizerRole" optionalLabel>
            <Select id="organizerRole" name="organizerRole" value={values.organizerRole} onChange={(e) => set("organizerRole", e.target.value)}>
              <option value="">Préciser…</option>
              <option value="Futur·e marié·e">Futur·e marié·e</option>
              <option value="Parent / famille">Parent ou membre de la famille</option>
              <option value="Organisateur·rice professionnel·le">Organisateur·rice professionnel·le</option>
              <option value="Lieu de réception">Lieu de réception</option>
              <option value="Autre">Autre</option>
            </Select>
          </Field>
        </div>
        <Field label="Un mot sur votre événement" htmlFor="message" error={errorFor("message")} optionalLabel help="Déroulé, envies, questions. Merci de n’y inscrire aucune information médicale ou sensible concernant les enfants.">
          <Textarea id="message" name="message" rows={5} value={values.message} onChange={(e) => set("message", e.target.value)} invalid={Boolean(errorFor("message"))} />
        </Field>
        <div className="flex flex-col gap-3 border-t border-sage-200 pt-5">
          <Checkbox
            id="privacyAccepted"
            name="privacyAccepted"
            checked={values.privacyAccepted}
            onChange={(e) => set("privacyAccepted", e.target.checked)}
            label={
              <>
                J’ai pris connaissance de la{" "}
                <Link href="/confidentialite" className="underline" target="_blank">
                  politique de confidentialité
                </Link>
                . Les informations saisies servent à étudier et préparer ma demande (mesures précontractuelles).
              </>
            }
          />
          {errorFor("privacyAccepted") ? (
            <p role="alert" className="text-sm font-medium text-danger-600">
              {errorFor("privacyAccepted")?.join(" ")}
            </p>
          ) : null}
          <Checkbox id="marketingOptIn" name="marketingOptIn" checked={values.marketingOptIn} onChange={(e) => set("marketingOptIn", e.target.checked)} label="J’accepte de recevoir occasionnellement des nouvelles de l’activité (facultatif, révocable à tout moment)." />
        </div>
      </fieldset>

      {/* Step 5: summary */}
      {current.id === "summary" ? (
        <section className="flex flex-col gap-6">
          <h2 className="font-display text-2xl">Récapitulatif</h2>
          <p className="text-[15px] leading-snug text-ink-500">Vérifiez vos réponses. Votre demande sera étudiée par Marie ; elle ne constitue pas une réservation.</p>
          <dl className="divide-y divide-sage-100 border-y border-sage-200">
            {[
              { step: "event" as const, label: "Événement", value: `${EVENT_TYPE_LABELS[values.eventType as keyof typeof EVENT_TYPE_LABELS] ?? values.eventType} · ${values.dateMode === "FIXED" ? `${values.eventDate || "—"}${values.eventEndDate ? ` → ${values.eventEndDate}` : ""}, ${values.startTime || "—"} → ${values.endTime || "—"}` : `date incertaine (${values.dateNote || values.eventDate || "à préciser"})`}` },
              { step: "place" as const, label: "Lieu", value: `${values.venueMode === "PARTNER" ? selectedVenue?.name ?? "—" : values.venueName || "—"}, ${values.postalCode} ${values.city}` },
              { step: "children" as const, label: "Enfants", value: `${totalChildren} au total (${(Object.keys(AGE_GROUP_LABELS) as Array<keyof typeof AGE_GROUP_LABELS>).filter((k) => Number(values[k]) > 0).map((k) => `${values[k]} ${AGE_GROUP_LABELS[k].toLowerCase()}`).join(", ") || "à préciser"}) · parents sur place : ${TRI_STATE_LABELS[values.parentsOnSite as keyof typeof TRI_STATE_LABELS]} · espace : ${values.dedicatedSpace === "UNKNOWN" ? "à préciser" : TRI_STATE_LABELS[values.dedicatedSpace as keyof typeof TRI_STATE_LABELS]}${optionLabels.length ? ` · options : ${optionLabels.join(", ")}` : ""}` },
              { step: "contact" as const, label: "Contact", value: `${values.organizerName} · ${values.organizerEmail}${values.organizerPhone ? ` · ${values.organizerPhone}` : ""}${values.organizerRole ? ` · ${values.organizerRole}` : ""}` },
            ].map((row) => (
              <div key={row.step} className="grid gap-1 py-4 sm:grid-cols-[140px_1fr_auto] sm:gap-6">
                <dt className="text-[13px] font-semibold text-ink-500">{row.label}</dt>
                <dd className="text-[15px] text-ink-900">{row.value}</dd>
                <dd>
                  <button type="button" onClick={() => goTo(row.step)} className="specimen-link cursor-pointer text-sm font-semibold text-sage-800">
                    Modifier
                  </button>
                </dd>
              </div>
            ))}
          </dl>
          {values.message ? <p className="text-[15px] leading-relaxed text-ink-700 whitespace-pre-line">{values.message}</p> : null}
        </section>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-sage-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        {stepIndex > 0 ? (
          <Button type="button" variant="ghost" onClick={goBack}>
            Retour
          </Button>
        ) : (
          <span />
        )}
        {current.id === "summary" ? (
          <SubmitButton />
        ) : (
          <Button type="button" size="lg" onClick={goNext}>
            Continuer
          </Button>
        )}
      </div>
    </form>
  );
}
