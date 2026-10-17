import { Check, Minus, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatEuros } from "@/lib/utils";
import { FEATURES, type FeatureKey } from "@/modules/billing/domain/plans";
import type { PlanWithFeatures } from "@/modules/billing/application/subscription-service";
import { cn } from "@/lib/utils";

/**
 * Side-by-side plans of one audience with a feature matrix. `highlightFeature`
 * is the feature that triggered a paywall; `renderCta(plan)` lets the caller
 * decide what the button does (subscribe form, sign-in link…).
 */
export function PlanComparison({
  plans,
  currentPlanKey,
  highlightFeature,
  renderCta,
}: {
  plans: PlanWithFeatures[];
  currentPlanKey?: string | null;
  highlightFeature?: FeatureKey | null;
  renderCta?: (plan: PlanWithFeatures) => React.ReactNode;
}) {
  const featureKeys = [...new Set(plans.flatMap((p) => p.features.filter((f) => f.enabled).map((f) => f.key)))];
  const ordered = (Object.keys(FEATURES) as FeatureKey[]).filter((k) => featureKeys.includes(k));
  return (
    <div className="space-y-6">
      <div className={cn("grid gap-4", plans.length > 1 ? "sm:grid-cols-2" : "")}>
        {plans.map((plan) => {
          const current = plan.key === currentPlanKey;
          const paid = plan.priceMonthlyCents > 0;
          return (
            <Card key={plan.id} className={cn("gap-4 p-6", paid && "border-primary/40 shadow-sm")} data-plan={plan.key}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {paid && <Sparkles className="size-4 text-primary" aria-hidden="true" />}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {current && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Votre offre actuelle</span>}
                </div>
                <p className="text-sm text-muted-foreground text-pretty">{plan.description}</p>
              </div>
              <p className="font-heading text-3xl font-semibold">
                {paid ? formatEuros(plan.priceMonthlyCents) : "0 €"}
                <span className="text-sm font-normal text-muted-foreground"> TTC / mois{paid ? ", sans engagement" : ""}</span>
              </p>
              {renderCta ? renderCta(plan) : null}
            </Card>
          );
        })}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Comparatif des fonctionnalités par offre</caption>
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th scope="col" className="px-4 py-3 font-medium">
                Fonctionnalité
              </th>
              {plans.map((p) => (
                <th key={p.id} scope="col" className="px-4 py-3 text-center font-medium">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((key) => {
              const highlighted = key === highlightFeature;
              return (
                <tr key={key} className={cn("border-b last:border-0", highlighted && "bg-accent/60")} data-feature={key}>
                  <th scope="row" className="px-4 py-2.5 text-left font-normal">
                    {FEATURES[key]}
                    {highlighted && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Ce qui vous intéresse</span>}
                  </th>
                  {plans.map((p) => {
                    const f = p.features.find((x) => x.key === key);
                    return (
                      <td key={p.id} className="px-4 py-2.5 text-center">
                        {f?.enabled ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <Check className="size-4" aria-hidden="true" />
                            <span className={f.limit !== null ? "text-foreground" : "sr-only"}>{f.limit !== null ? `jusqu'à ${f.limit}` : "Inclus"}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            <Minus className="inline size-4" aria-hidden="true" />
                            <span className="sr-only">Non inclus</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
