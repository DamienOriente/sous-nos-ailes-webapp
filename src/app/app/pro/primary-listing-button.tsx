"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setPrimaryListingAction } from "./structure/actions";

/** Agency: chooses the listing that stays online if the agency subscription stops. */
export function PrimaryListingButton({ professionalId }: { professionalId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="link"
      className="h-auto px-0"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const fd = new FormData();
          fd.set("professionalId", professionalId);
          const res = await setPrimaryListingAction(fd);
          if (res.ok) toast.success("Cette fiche restera visible en cas d'impayé.");
          else toast.error(res.error);
        })
      }
    >
      Garder visible en cas d'impayé
    </Button>
  );
}
