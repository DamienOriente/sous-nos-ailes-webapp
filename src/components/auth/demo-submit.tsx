"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/** Client island only for the pending state: every button is disabled while one sign-in runs. */
export function DemoSubmit({ value, name, role }: { value: string; name: string; role: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("account") === value;
  return (
    <button
      type="submit"
      name="account"
      value={value}
      disabled={pending}
      aria-label={`Se connecter en tant que ${name}, ${role}`}
      className={cn(
        "flex w-full flex-col items-start rounded-lg border bg-background px-3 py-2 text-left transition-colors duration-150 hover:border-foreground/30 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60",
      )}
    >
      <span className="text-sm font-medium">{mine ? "Connexion…" : name}</span>
      <span className="text-xs text-muted-foreground">{role}</span>
    </button>
  );
}
