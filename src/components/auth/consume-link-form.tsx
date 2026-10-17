"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { consumeLoginLink } from "@/server/actions/auth";
import { idleState } from "@/server/action-state";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className="w-full">
      {pending ? "Connexion…" : "Confirmer ma connexion"}
    </Button>
  );
}

export function ConsumeLinkForm({ token }: { token: string }) {
  const [state, action] = useActionState(consumeLoginLink, idleState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state.status === "error" ? (
        <Alert kind="danger" role="alert">
          {state.message}{" "}
          <Link href="/connexion" className="font-semibold underline">
            Demander un nouveau lien
          </Link>
        </Alert>
      ) : null}
      <Submit />
    </form>
  );
}
