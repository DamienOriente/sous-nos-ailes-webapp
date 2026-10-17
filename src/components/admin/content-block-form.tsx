"use client";

import { useActionState } from "react";
import { updateContentAction } from "@/server/actions/admin/content";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Field, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/admin/submit-button";
import { errorsOf, valueOf } from "@/components/admin/form-utils";

export function ContentBlockForm({ blockKey, title, body }: { blockKey: string; title: string; body: string }) {
  const [state, action] = useActionState(updateContentAction.bind(null, blockKey), idleState);
  const id = `content-${blockKey.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {state.status === "success" ? <Alert kind="success" role="status">{state.message}</Alert> : null}
      {state.status === "error" ? <Alert kind="danger" role="alert">{state.message}</Alert> : null}
      <Field label={title} htmlFor={id} error={errorsOf(state, "body")} help={`Clé technique : ${blockKey}. Texte brut ; une ligne vide sépare deux paragraphes.`}>
        <Textarea id={id} name="body" defaultValue={valueOf(state, "body", body)} className="min-h-40" maxLength={20_000} invalid={Boolean(errorsOf(state, "body"))} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton label="Enregistrer ce texte" variant="secondary" size="sm" />
      </div>
    </form>
  );
}
