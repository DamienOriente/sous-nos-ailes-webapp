"use client";

import { useActionState } from "react";
import { updateProviderProfileAction } from "@/server/actions/portal/provider";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/portal/submit-button";

export type ProviderProfileValues = {
  displayName: string;
  city: string;
  postalCode: string | null;
  sector: string;
  bio: string | null;
  skills: string[];
};

export function ProviderProfileForm({ values, ownerFirstName }: { values: ProviderProfileValues; ownerFirstName: string }) {
  const [state, formAction] = useActionState(updateProviderProfileAction, idleState);
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom d’affichage" htmlFor="displayName" required error={errors.displayName} help={`Visible par ${ownerFirstName} et par l’équipe d’une même mission.`}>
          <Input id="displayName" name="displayName" required maxLength={80} defaultValue={values.displayName} aria-describedby="displayName-help" invalid={Boolean(errors.displayName)} />
        </Field>
        <Field label="Secteur d’intervention" htmlFor="sector" required error={errors.sector} help="Zone dans laquelle vous acceptez de vous déplacer.">
          <Input id="sector" name="sector" required maxLength={160} defaultValue={values.sector} aria-describedby="sector-help" invalid={Boolean(errors.sector)} />
        </Field>
        <Field label="Commune" htmlFor="city" required error={errors.city}>
          <Input id="city" name="city" required maxLength={120} autoComplete="address-level2" defaultValue={values.city} invalid={Boolean(errors.city)} />
        </Field>
        <Field label="Code postal" htmlFor="postalCode" optionalLabel error={errors.postalCode}>
          <Input id="postalCode" name="postalCode" inputMode="numeric" maxLength={5} autoComplete="postal-code" defaultValue={values.postalCode ?? ""} invalid={Boolean(errors.postalCode)} />
        </Field>
      </div>
      <Field label="Présentation" htmlFor="bio" optionalLabel error={errors.bio} help="Votre parcours et votre manière d’être avec les enfants. N’indiquez aucune information sur des enfants ou des familles.">
        <Textarea id="bio" name="bio" rows={5} maxLength={2000} defaultValue={values.bio ?? ""} aria-describedby="bio-help" invalid={Boolean(errors.bio)} />
      </Field>
      <Field label="Compétences" htmlFor="skills" optionalLabel error={errors.skills} help="Séparées par des virgules : animation, lecture, tout-petits, langue des signes…">
        <Input id="skills" name="skills" maxLength={500} defaultValue={values.skills.join(", ")} aria-describedby="skills-help" invalid={Boolean(errors.skills)} />
      </Field>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer le profil</SubmitButton>
      </div>
    </form>
  );
}
