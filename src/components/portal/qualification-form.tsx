"use client";

import { useActionState } from "react";
import { addQualificationAction } from "@/server/actions/portal/provider";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/portal/submit-button";

export function QualificationForm() {
  const [state, formAction] = useActionState(addQualificationAction, idleState);
  const errors = state.fieldErrors ?? {};
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
      <form key={formKey} action={formAction} noValidate className="flex flex-col gap-4">
        <Field label="Intitulé" htmlFor="qualification-label" required error={errors.label} help="Diplôme, formation, attestation (PSC1, CAP AEPE…).">
          <Input id="qualification-label" name="label" required maxLength={160} aria-describedby="qualification-label-help" invalid={Boolean(errors.label)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Organisme" htmlFor="qualification-issuer" optionalLabel error={errors.issuer}>
            <Input id="qualification-issuer" name="issuer" maxLength={160} invalid={Boolean(errors.issuer)} />
          </Field>
          <Field label="Année" htmlFor="qualification-year" optionalLabel error={errors.year}>
            <Input id="qualification-year" name="year" inputMode="numeric" min={1950} max={2100} type="number" invalid={Boolean(errors.year)} />
          </Field>
        </div>
        <div>
          <SubmitButton pendingLabel="Enregistrement…" variant="secondary">
            Déclarer cette qualification
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
