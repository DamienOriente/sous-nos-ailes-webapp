import { Check } from "lucide-react";
import { FEATURE_PREVIEWS } from "@/components/billing/tool-previews";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FEATURES, type FeatureKey } from "@/modules/billing/domain/plans";
import type { PlanWithFeatures } from "@/modules/billing/application/subscription-service";

/**
 * "What changes with the paid plan": the features of the paid plan missing
 * from the free one, each with its miniature and three concrete changes. The
 * highlighted feature (the one that triggered the paywall) comes first.
 */
export function PlanChanges({ audience, plans, currentPlanKey, highlightFeature }: { audience: "organizer" | "professional"; plans: PlanWithFeatures[]; currentPlanKey: string | null; highlightFeature?: FeatureKey | null }) {
  const paid = plans.find((p) => p.priceMonthlyCents > 0);
  const free = plans.find((p) => p.priceMonthlyCents === 0);
  if (!paid || !free) return null;
  const extras = paid.features.filter((f) => f.enabled && !free.features.some((g) => g.key === f.key && g.enabled)).map((f) => f.key as FeatureKey);
  const withPreview = extras.filter((k) => FEATURE_PREVIEWS[k]);
  const ordered = highlightFeature && withPreview.includes(highlightFeature) ? [highlightFeature, ...withPreview.filter((k) => k !== highlightFeature)] : withPreview;
  const shown = ordered.slice(0, 4);
  if (shown.length === 0) return null;
  const alreadyPaid = currentPlanKey === paid.key;
  return (
    <section className="space-y-4" aria-labelledby="changements">
      <div>
        <h2 id="changements" className="text-xl font-semibold">
          {alreadyPaid ? `Ce que ${paid.name} vous apporte` : `Ce qui change avec ${paid.name}`}
        </h2>
        <p className="text-sm text-muted-foreground">Aperçus rendus avec des données d'exemple (évènement et fiches de démonstration), pas vos propres données.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((key) => {
          const def = FEATURE_PREVIEWS[key]!;
          const highlighted = key === highlightFeature;
          return (
            <Card key={key} className={cn("gap-0 overflow-hidden p-0", highlighted && "border-primary/50 ring-2 ring-primary/20")} data-testid="plan-change" data-feature={key}>
              <div className="border-b bg-muted/40">{def.render(audience)}</div>
              <div className="space-y-2 p-4">
                <h3 className="flex flex-wrap items-center gap-2 font-medium">
                  {FEATURES[key]}
                  {highlighted && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Ce qui vous intéresse</span>}
                </h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {def.changes.map((c) => (
                    <li key={c} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
