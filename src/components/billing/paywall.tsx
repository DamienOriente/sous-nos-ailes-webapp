import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FEATURES, type FeatureKey } from "@/modules/billing/domain/plans";

/**
 * Contextual paywall: shown in place of a premium tool, with a concrete
 * description of what the tool does, the price, a subscribe button and a way
 * back. Never blocks navigation elsewhere.
 */
export function Paywall({
  feature,
  audience,
  title,
  description,
  preview,
  backHref,
  backLabel = "Retour",
  priceLabel,
}: {
  feature: FeatureKey;
  audience: "organizer" | "professional";
  title?: string;
  description: string;
  preview?: React.ReactNode;
  backHref: string;
  backLabel?: string;
  priceLabel?: string;
}) {
  const planName = audience === "organizer" ? "Organisateur Plus" : "Professionnel Premium";
  const price = priceLabel ?? (audience === "organizer" ? "9,90 € TTC / mois" : "19,90 € TTC / mois");
  return (
    <Card className="mx-auto max-w-2xl gap-6 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Lock className="size-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Inclus dans {planName}</p>
          <h2 className="text-xl font-semibold">{title ?? FEATURES[feature]}</h2>
          <p className="text-sm text-muted-foreground text-pretty">{description}</p>
        </div>
      </div>
      {preview && <div className="overflow-hidden rounded-xl border bg-muted/40">{preview}</div>}
      <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">{price}</p>
          <p className="text-xs text-muted-foreground">Sans engagement, résiliable à tout moment. Aucun frais caché.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
          <Button asChild>
            <Link href={`/app/compte/abonnement?audience=${audience}&feature=${feature}`}>
              <Sparkles className="size-4" aria-hidden="true" />
              Découvrir {planName}
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
