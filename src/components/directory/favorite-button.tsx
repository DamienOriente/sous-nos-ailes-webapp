"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleFavoriteAction } from "@/app/(public)/annuaire/actions";

/** Heart toggle; anonymous visitors are sent to sign in. */
export function FavoriteButton({ professionalId, isFavorite, signedIn, className }: { professionalId: string; isFavorite: boolean; signedIn: boolean; className?: string }) {
  const [optimistic, setOptimistic] = useOptimistic(isFavorite);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("rounded-full", className)}
      aria-pressed={optimistic}
      aria-label={optimistic ? "Retirer des favoris" : "Ajouter aux favoris"}
      disabled={pending}
      onClick={() => {
        if (!signedIn) {
          toast.info("Connectez-vous pour enregistrer vos favoris.");
          router.push(`/connexion?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }
        start(async () => {
          setOptimistic(!optimistic);
          const res = await toggleFavoriteAction(professionalId);
          if (!res.ok) toast.error(res.error);
        });
      }}
    >
      <Heart className={cn("size-4", optimistic ? "fill-blush-deep text-blush-deep" : "")} aria-hidden="true" />
    </Button>
  );
}
