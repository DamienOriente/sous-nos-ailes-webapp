"use client";
import { useState, useTransition } from "react";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

export function AcceptInvitationButton({ token, action }: { token: string; action: (token: string) => Promise<ActionResult> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          start(async () => {
            const res = await action(token);
            // On success the action redirects; only errors come back.
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {pending ? "Acceptation…" : "Accepter l'invitation"}
      </Button>
      <FormMessage error={error} />
    </div>
  );
}
