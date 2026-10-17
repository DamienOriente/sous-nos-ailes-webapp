"use client";

import { useActionState } from "react";
import { updateEventDetailsAction } from "@/server/actions/admin/events";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/admin/submit-button";
import { HelpText, SubHeading } from "@/components/admin/section";
import { checkedOf, errorsOf, valueOf } from "@/components/admin/form-utils";
import { AGE_GROUP_LABELS, EVENT_TYPE_LABELS, TRI_STATE_LABELS } from "@/domain/labels";
import type { EventType, TriState } from "@/generated/prisma/enums";

export type EventDetailsFormProps = {
  eventId: string;
  event: {
    eventType: EventType;
    date: string | null;
    endDate: string | null;
    dateIsFlexible: boolean;
    dateNote: string | null;
    startTime: string | null;
    endTime: string | null;
    venueId: string | null;
    venueName: string | null;
    venueAddressNote: string | null;
    city: string;
    postalCode: string;
    childrenUnder3: number;
    children3to5: number;
    children6to10: number;
    children11plus: number;
    parentsOnSite: TriState;
    dedicatedSpace: TriState;
    requiredProviders: number;
  };
  venues: Array<{ id: string; name: string; city: string }>;
  staffing: { suggested: number; explanation: string[]; requiresUnder3Study: boolean };
};

const TRI_STATES: TriState[] = ["YES", "PARTIAL", "NO", "UNKNOWN"];
const EVENT_TYPES: EventType[] = ["WEDDING", "PRIVATE_PARTY", "PROFESSIONAL", "OTHER"];
const AGE_KEYS = ["childrenUnder3", "children3to5", "children6to10", "children11plus"] as const;

export function EventDetailsForm({ eventId, event, venues, staffing }: EventDetailsFormProps) {
  const [state, action] = useActionState(updateEventDetailsAction.bind(null, eventId), idleState);
  const under3 = Number(valueOf(state, "childrenUnder3", event.childrenUnder3));
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {state.status === "success" ? <Alert kind="success" role="status">{state.message}</Alert> : null}
      {state.status === "error" ? <Alert kind="danger" role="alert">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type d’événement" htmlFor="eventType" error={errorsOf(state, "eventType")} required>
          <Select id="eventType" name="eventType" defaultValue={valueOf(state, "eventType", event.eventType)}>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Intervenant·es requis·es" htmlFor="requiredProviders" error={errorsOf(state, "requiredProviders")} required help={`Suggestion : ${staffing.suggested}. Paramètre interne à valider par vous, jamais une norme.`}>
          <Input id="requiredProviders" name="requiredProviders" type="number" min={1} max={30} inputMode="numeric" defaultValue={valueOf(state, "requiredProviders", event.requiredProviders)} invalid={Boolean(errorsOf(state, "requiredProviders"))} />
        </Field>
      </div>

      <div className="rounded-md border border-sage-200 bg-ivory-100 px-4 py-3">
        <p className="text-[13px] font-semibold text-ink-500">Comment la suggestion est calculée</p>
        <ul className="mt-1 list-disc pl-5 text-sm leading-snug text-ink-700">
          {staffing.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div>
        <SubHeading>Date et horaires</SubHeading>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="date" error={errorsOf(state, "date")}>
            <Input id="date" name="date" type="date" defaultValue={valueOf(state, "date", event.date)} invalid={Boolean(errorsOf(state, "date"))} />
          </Field>
          <Field label="Date de fin" htmlFor="endDate" error={errorsOf(state, "endDate")} optionalLabel help="Laissez vide si la garde se termine le même jour ou juste après minuit.">
            <Input id="endDate" name="endDate" type="date" defaultValue={valueOf(state, "endDate", event.endDate)} invalid={Boolean(errorsOf(state, "endDate"))} />
          </Field>
          <Field label="Heure de début" htmlFor="startTime" error={errorsOf(state, "startTime")}>
            <Input id="startTime" name="startTime" type="time" defaultValue={valueOf(state, "startTime", event.startTime)} invalid={Boolean(errorsOf(state, "startTime"))} />
          </Field>
          <Field label="Heure de fin" htmlFor="endTime" error={errorsOf(state, "endTime")}>
            <Input id="endTime" name="endTime" type="time" defaultValue={valueOf(state, "endTime", event.endTime)} invalid={Boolean(errorsOf(state, "endTime"))} />
          </Field>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <Checkbox id="dateIsFlexible" name="dateIsFlexible" label="Date encore incertaine (à fixer avec l’organisateur)" defaultChecked={checkedOf(state, "dateIsFlexible", event.dateIsFlexible)} />
          <Field label="Précision sur la date" htmlFor="dateNote" error={errorsOf(state, "dateNote")} optionalLabel>
            <Input id="dateNote" name="dateNote" defaultValue={valueOf(state, "dateNote", event.dateNote)} maxLength={300} invalid={Boolean(errorsOf(state, "dateNote"))} />
          </Field>
        </div>
      </div>

      <div>
        <SubHeading>Lieu</SubHeading>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Lieu partenaire" htmlFor="venueId" error={errorsOf(state, "venueId")} optionalLabel help="Choisir un lieu partenaire reprend son nom et active la mémoire du lieu.">
            <Select id="venueId" name="venueId" defaultValue={valueOf(state, "venueId", event.venueId)}>
              <option value="">Aucun (lieu libre)</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name} — {venue.city}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nom du lieu" htmlFor="venueName" error={errorsOf(state, "venueName")} optionalLabel>
            <Input id="venueName" name="venueName" defaultValue={valueOf(state, "venueName", event.venueName)} maxLength={160} invalid={Boolean(errorsOf(state, "venueName"))} />
          </Field>
          <Field label="Commune" htmlFor="city" error={errorsOf(state, "city")} required>
            <Input id="city" name="city" defaultValue={valueOf(state, "city", event.city)} maxLength={120} required invalid={Boolean(errorsOf(state, "city"))} />
          </Field>
          <Field label="Code postal" htmlFor="postalCode" error={errorsOf(state, "postalCode")} required>
            <Input id="postalCode" name="postalCode" inputMode="numeric" defaultValue={valueOf(state, "postalCode", event.postalCode)} maxLength={5} required invalid={Boolean(errorsOf(state, "postalCode"))} />
          </Field>
          <Field label="Précision d’adresse" htmlFor="venueAddressNote" error={errorsOf(state, "venueAddressNote")} optionalLabel className="sm:col-span-2">
            <Input id="venueAddressNote" name="venueAddressNote" defaultValue={valueOf(state, "venueAddressNote", event.venueAddressNote)} maxLength={300} invalid={Boolean(errorsOf(state, "venueAddressNote"))} />
          </Field>
        </div>
      </div>

      <div>
        <SubHeading>Effectifs par âge</SubHeading>
        <div className="mt-3 grid gap-4 sm:grid-cols-4">
          {AGE_KEYS.map((key) => (
            <Field key={key} label={AGE_GROUP_LABELS[key]} htmlFor={key} error={errorsOf(state, key)}>
              <Input id={key} name={key} type="number" min={0} max={200} inputMode="numeric" defaultValue={valueOf(state, key, event[key])} invalid={Boolean(errorsOf(state, key))} />
            </Field>
          ))}
        </div>
        {under3 > 0 ? (
          <Alert kind="warning" className="mt-4" role="status">
            Des enfants de moins de 3 ans sont annoncés : l’accueil de cette tranche d’âge demande une étude spécifique (espace de repos, encadrement renforcé). Aucune prise en charge n’est automatique.
          </Alert>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Parents sur place" htmlFor="parentsOnSite" error={errorsOf(state, "parentsOnSite")} required>
            <Select id="parentsOnSite" name="parentsOnSite" defaultValue={valueOf(state, "parentsOnSite", event.parentsOnSite)}>
              {TRI_STATES.map((value) => (
                <option key={value} value={value}>
                  {TRI_STATE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Espace dédié aux enfants" htmlFor="dedicatedSpace" error={errorsOf(state, "dedicatedSpace")} required>
            <Select id="dedicatedSpace" name="dedicatedSpace" defaultValue={valueOf(state, "dedicatedSpace", event.dedicatedSpace)}>
              {TRI_STATES.map((value) => (
                <option key={value} value={value}>
                  {TRI_STATE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-sage-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <HelpText>Enregistrer recalcule le titre, les horaires UTC et la checklist adaptée.</HelpText>
        <SubmitButton label="Enregistrer la fiche" />
      </div>
    </form>
  );
}

/** Preparation answers, normally filled by the client, editable by Marie. */
export function PreparationFields({ state, event }: { state: Parameters<typeof valueOf>[0]; event: { dedicatedSpace: TriState; spaceDescription: string | null; meetingPoint: string | null; onSiteContactName: string | null; onSiteContactPhone: string | null; scheduleNotes: string | null } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Espace dédié aux enfants" htmlFor="prep-dedicatedSpace" error={errorsOf(state, "dedicatedSpace")} required>
        <Select id="prep-dedicatedSpace" name="dedicatedSpace" defaultValue={valueOf(state, "dedicatedSpace", event.dedicatedSpace)}>
          {TRI_STATES.map((value) => (
            <option key={value} value={value}>
              {TRI_STATE_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Point de rendez-vous de l’équipe" htmlFor="prep-meetingPoint" error={errorsOf(state, "meetingPoint")} optionalLabel>
        <Input id="prep-meetingPoint" name="meetingPoint" defaultValue={valueOf(state, "meetingPoint", event.meetingPoint)} maxLength={300} invalid={Boolean(errorsOf(state, "meetingPoint"))} />
      </Field>
      <Field label="Description de l’espace" htmlFor="prep-spaceDescription" error={errorsOf(state, "spaceDescription")} optionalLabel className="sm:col-span-2" help="Surface, accès, sanitaires, point d’eau, matériel disponible.">
        <Textarea id="prep-spaceDescription" name="spaceDescription" defaultValue={valueOf(state, "spaceDescription", event.spaceDescription)} maxLength={1000} invalid={Boolean(errorsOf(state, "spaceDescription"))} />
      </Field>
      <Field label="Contact opérationnel sur place" htmlFor="prep-onSiteContactName" error={errorsOf(state, "onSiteContactName")} optionalLabel>
        <Input id="prep-onSiteContactName" name="onSiteContactName" defaultValue={valueOf(state, "onSiteContactName", event.onSiteContactName)} maxLength={120} invalid={Boolean(errorsOf(state, "onSiteContactName"))} />
      </Field>
      <Field label="Téléphone du contact" htmlFor="prep-onSiteContactPhone" error={errorsOf(state, "onSiteContactPhone")} optionalLabel>
        <Input id="prep-onSiteContactPhone" name="onSiteContactPhone" type="tel" inputMode="tel" defaultValue={valueOf(state, "onSiteContactPhone", event.onSiteContactPhone)} maxLength={30} invalid={Boolean(errorsOf(state, "onSiteContactPhone"))} />
      </Field>
      <Field label="Déroulé et consignes" htmlFor="prep-scheduleNotes" error={errorsOf(state, "scheduleNotes")} optionalLabel className="sm:col-span-2" help="Moments clés de la soirée, repas des enfants, temps calmes, consignes du lieu.">
        <Textarea id="prep-scheduleNotes" name="scheduleNotes" defaultValue={valueOf(state, "scheduleNotes", event.scheduleNotes)} maxLength={1000} invalid={Boolean(errorsOf(state, "scheduleNotes"))} />
      </Field>
    </div>
  );
}
