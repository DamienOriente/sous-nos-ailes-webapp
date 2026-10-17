"use client";

import { useActionState } from "react";
import { addAvailabilityAction } from "@/server/actions/portal/provider";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Field, Input, RadioOption } from "@/components/ui/field";
import { SubmitButton } from "@/components/portal/submit-button";

export function AvailabilityForm() {
  const [state, formAction] = useActionState(addAvailabilityAction, idleState);
  const errors = state.fieldErrors ?? {};
  // Remount the form after a successful save so the fields start empty again.
  const formKey = state.status === "success" ? String(state.data?.savedAt ?? "saved") : "initial";
  return (
    <div className="flex flex-col gap-4">
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
      <form key={formKey} action={formAction} noValidate className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[15px] font-semibold text-ink-900">Type de période</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <RadioOption id="kind-available" name="kind" value="AVAILABLE" label="Disponible" description="Vous indiquez pouvoir intervenir sur cette période." defaultChecked />
            <RadioOption id="kind-unavailable" name="kind" value="UNAVAILABLE" label="Indisponible" description="Vous indiquez ne pas pouvoir intervenir sur cette période." />
          </div>
          {errors.kind ? (
            <p role="alert" className="text-sm font-medium text-danger-600">
              {errors.kind.join(" ")}
            </p>
          ) : null}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Début — date" htmlFor="startDate" required error={errors.startDate}>
            <Input id="startDate" name="startDate" type="date" required invalid={Boolean(errors.startDate)} />
          </Field>
          <Field label="Début — heure" htmlFor="startTime" required error={errors.startTime}>
            <Input id="startTime" name="startTime" type="time" required invalid={Boolean(errors.startTime)} />
          </Field>
          <Field label="Fin — date" htmlFor="endDate" required error={errors.endDate}>
            <Input id="endDate" name="endDate" type="date" required invalid={Boolean(errors.endDate)} />
          </Field>
          <Field label="Fin — heure" htmlFor="endTime" required error={errors.endTime}>
            <Input id="endTime" name="endTime" type="time" required invalid={Boolean(errors.endTime)} />
          </Field>
        </div>
        <Field label="Note" htmlFor="availability-note" optionalLabel error={errors.note} help="Par exemple : « uniquement en soirée », « congés ».">
          <Input id="availability-note" name="note" maxLength={200} aria-describedby="availability-note-help" invalid={Boolean(errors.note)} />
        </Field>
        <div>
          <SubmitButton pendingLabel="Enregistrement…">Ajouter la période</SubmitButton>
        </div>
      </form>
    </div>
  );
}
