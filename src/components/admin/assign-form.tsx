"use client";

import { useActionState } from "react";
import { assignProviderAction, type AssignState } from "@/server/actions/admin/team";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/admin/submit-button";

/** Confirms an accepted invitation as an assignment; conflicts are listed explicitly. */
export function AssignForm({ eventId, invitationId, providerId, providerName, defaultCost }: { eventId: string; invitationId: string; providerId: string; providerName: string; defaultCost: string }) {
  const [state, action] = useActionState<AssignState, FormData>(assignProviderAction.bind(null, eventId, invitationId, providerId), idleState);
  const idBase = `assign-${invitationId}`;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {state.status === "error" ? (
        <Alert kind="danger" role="alert" title={state.message}>
          {state.data?.details?.length ? (
            <ul className="list-disc pl-5">
              {state.data.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Rôle dans l’équipe" htmlFor={`${idBase}-role`} error={state.fieldErrors?.roleLabel} optionalLabel>
          <Input id={`${idBase}-role`} name="roleLabel" maxLength={80} placeholder="Référent·e, renfort…" />
        </Field>
        <Field label="Coût convenu (€)" htmlFor={`${idBase}-cost`} error={state.fieldErrors?.agreedCost} help="Vide : coût habituel du profil.">
          <Input id={`${idBase}-cost`} name="agreedCost" inputMode="decimal" placeholder={defaultCost} invalid={Boolean(state.fieldErrors?.agreedCost)} />
        </Field>
        <SubmitButton label={`Affecter ${providerName}`} pendingLabel="Affectation…" variant="sage" />
      </div>
    </form>
  );
}
