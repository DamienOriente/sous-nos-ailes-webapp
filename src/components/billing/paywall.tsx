import Link from "next/link";
import { Check, Lock, Sparkles } from "lucide-react";
import { featurePreview } from "@/components/billing/tool-previews";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FEATURES, type FeatureKey } from "@/modules/billing/domain/plans";

/**
 * Contextual paywall: shown in place of a premium tool, with a real miniature
 * of the tool (React render, fictitious example data), the three concrete
 * changes, the price, a subscribe button and a way back. Never blocks
 * navigation elsewhere. A caller may pass its own `preview`.
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
  const builtIn = featurePreview(feature, audience);
  const shown = preview ?? builtIn?.node ?? null;
  return (
    <Card className="mx-auto max-w-3xl gap-0 overflow-hidden p-0" data-testid="paywall" data-feature={feature}>
      <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Lock className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Inclus dans {planName}</p>
              <h2 className="font-heading text-2xl font-semibold text-balance">{title ?? FEATURES[feature]}</h2>
              <p className="text-sm text-muted-foreground text-pretty">{description}</p>
            </div>
          </div>
          {builtIn && (
            <ul className="space-y-2 text-sm">
              {builtIn.changes.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4">
            <div>
              <p className="font-medium">{price}</p>
              <p className="text-xs text-muted-foreground">Sans engagement, résiliable à tout moment. Aucun frais caché.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/app/compte/abonnement?audience=${audience}&feature=${feature}`}>
                  <Sparkles className="size-4" aria-hidden="true" />
                  Découvrir {planName}
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={backHref}>{backLabel}</Link>
              </Button>
            </div>
          </div>
        </div>
        {shown && (
          <div className="relative border-t bg-muted/40 lg:border-l lg:border-t-0">
            <div className="overflow-hidden">{shown}</div>
            <p className="border-t bg-card/80 px-3 py-1.5 text-[11px] text-muted-foreground">Aperçu avec des données d'exemple (évènement de démonstration).</p>
          </div>
        )}
      </div>
    </Card>
  );
}
