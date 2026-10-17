"use client";

import { useActionState } from "react";
import type { TriState } from "@/generated/prisma/enums";
import { saveClientPreparation } from "@/server/actions/portal/client";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Field, Input, RadioOption, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/portal/submit-button";

export type ClientPreparationValues = {
  dedicatedSpace: TriState;
  spaceDescription: string | null;
  meetingPoint: string | null;
  onSiteContactName: string | null;
  onSiteContactPhone: string | null;
  scheduleNotes: string | null;
};

const SPACE_OPTIONS: Array<{ value: TriState; label: string; description: string }> = [
  { value: "YES", label: "Oui", description: "Une pièce ou un espace réservé aux enfants est prévu." },
  { value: "PARTIAL", label: "En partie", description: "Un coin dédié, dans un espace partagé avec les invités." },
  { value: "NO", label: "Non", description: "Aucun espace spécifique n’est prévu pour l’instant." },
  { value: "UNKNOWN", label: "À préciser", description: "Vous ne savez pas encore." },
];

const SENSITIVE_HELP = "N’indiquez aucune information médicale ou sensible concernant les enfants.";

export function ClientPreparationForm({ eventId, values, closed, ownerFirstName }: { eventId: string; values: ClientPreparationValues; closed: boolean; ownerFirstName: string }) {
  const [state, formAction] = useActionState(saveClientPreparation.bind(null, eventId), idleState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.status === "success" ? (
        <Alert kind="success" role="status">
          {state.message}
        </Alert>
      ) : null}
      {state.status === "error" ? (
        <Alert kind="danger" role="alert">
          {state.message}
        </Alert>
      ) : null}
      {closed ? (
        <Alert kind="info" role="status">
          Ce dossier est clos : les réponses ne peuvent plus être modifiées.
        </Alert>
      ) : null}
      <fieldset disabled={closed} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[15px] font-semibold text-ink-900">Un espace dédié aux enfants est-il prévu ?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SPACE_OPTIONS.map((option) => (
              <RadioOption
                key={option.value}
                id={`dedicatedSpace-${option.value}`}
                name="dedicatedSpace"
                value={option.value}
                label={option.label}
                description={option.description}
                defaultChecked={values.dedicatedSpace === option.value}
              />
            ))}
          </div>
          {errors.dedicatedSpace ? (
            <p role="alert" className="text-sm font-medium text-danger-600">
              {errors.dedicatedSpace.join(" ")}
            </p>
          ) : null}
        </fieldset>

        <p className="text-sm leading-snug text-ink-500">{SENSITIVE_HELP}</p>

        <Field label="Description de l’espace" htmlFor="spaceDescription" optionalLabel error={errors.spaceDescription} help="Taille, emplacement, mobilier, accès à un point d’eau…">
          <Textarea id="spaceDescription" name="spaceDescription" rows={3} maxLength={1000} defaultValue={values.spaceDescription ?? ""} aria-describedby="spaceDescription-help" invalid={Boolean(errors.spaceDescription)} />
        </Field>

        <Field label="Point de rendez-vous de l’équipe" htmlFor="meetingPoint" optionalLabel error={errors.meetingPoint} help="Où l’équipe doit-elle se présenter à son arrivée ?">
          <Input id="meetingPoint" name="meetingPoint" maxLength={300} defaultValue={values.meetingPoint ?? ""} aria-describedby="meetingPoint-help" invalid={Boolean(errors.meetingPoint)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact sur place — nom" htmlFor="onSiteContactName" optionalLabel error={errors.onSiteContactName}>
            <Input id="onSiteContactName" name="onSiteContactName" maxLength={120} autoComplete="off" defaultValue={values.onSiteContactName ?? ""} invalid={Boolean(errors.onSiteContactName)} />
          </Field>
          <Field label="Contact sur place — téléphone" htmlFor="onSiteContactPhone" optionalLabel error={errors.onSiteContactPhone} help={`Communiqué uniquement à l’équipe affectée et à ${ownerFirstName}.`}>
            <Input id="onSiteContactPhone" name="onSiteContactPhone" type="tel" inputMode="tel" maxLength={30} autoComplete="off" defaultValue={values.onSiteContactPhone ?? ""} aria-describedby="onSiteContactPhone-help" invalid={Boolean(errors.onSiteContactPhone)} />
          </Field>
        </div>

        <Field label="Déroulé prévu et remarques" htmlFor="scheduleNotes" optionalLabel error={errors.scheduleNotes} help={`Moments clés (repas, discours, animation), consignes d’accès… ${SENSITIVE_HELP}`}>
          <Textarea id="scheduleNotes" name="scheduleNotes" rows={4} maxLength={1000} defaultValue={values.scheduleNotes ?? ""} aria-describedby="scheduleNotes-help" invalid={Boolean(errors.scheduleNotes)} />
        </Field>

        {closed ? null : (
          <div>
            <SubmitButton pendingLabel="Enregistrement…">Enregistrer mes réponses</SubmitButton>
          </div>
        )}
      </fieldset>
    </form>
  );
}
