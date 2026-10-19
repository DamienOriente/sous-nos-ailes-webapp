"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { confirmExtraListingAction, payAgencyAction } from "./actions";

export function AgencyAddButtons({ professionalId, mode, label }: { professionalId: string; mode: "pay" | "confirm"; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            if (mode === "pay") {
              const res = await payAgencyAction(professionalId);
              if (res.ok) router.push(res.data.redirectTo);
              else setError(res.error);
            } else {
              const res = await confirmExtraListingAction(professionalId);
              if (res && !res.ok) setError(res.error);
            }
          })
        }
      >
        {pending ? "Un instant…" : label}
      </Button>
      <FormMessage error={error} />
    </div>
  );
}
