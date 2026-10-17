"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginWithPassword, requestLoginLink } from "@/server/actions/auth";
import { idleState } from "@/server/action-state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function MagicLinkForm() {
  const [state, action] = useActionState(requestLoginLink, idleState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.status === "success" ? <Alert kind="success" role="status">{state.message}</Alert> : null}
      {state.status === "error" ? <Alert kind="danger" role="alert">{state.message}</Alert> : null}
      <Field label="Adresse email" htmlFor="magic-email" error={state.fieldErrors?.email} required>
        <Input id="magic-email" name="email" type="email" autoComplete="email" inputMode="email" required invalid={Boolean(state.fieldErrors?.email)} />
      </Field>
      <Submit label="Recevoir un lien de connexion" pendingLabel="Envoi…" />
    </form>
  );
}

export function PasswordForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginWithPassword, idleState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.status === "error" ? <Alert kind="danger" role="alert">{state.message}</Alert> : null}
      <Field label="Adresse email" htmlFor="login-email" error={state.fieldErrors?.email} required>
        <Input id="login-email" name="email" type="email" autoComplete="username" inputMode="email" required invalid={Boolean(state.fieldErrors?.email)} />
      </Field>
      <Field label="Mot de passe" htmlFor="login-password" error={state.fieldErrors?.password} required>
        <Input id="login-password" name="password" type="password" autoComplete="current-password" required invalid={Boolean(state.fieldErrors?.password)} />
      </Field>
      <Submit label="Se connecter" pendingLabel="Connexion…" />
    </form>
  );
}
