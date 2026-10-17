import { notFound } from "next/navigation";
import { LiveBillingBanner } from "@/components/billing/live-billing-banner";
import { PlanComparison } from "@/components/billing/plan-comparison";
import { SubscriptionCard } from "@/components/billing/subscription-card";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stripeConfigured } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { formatEuros } from "@/lib/utils";
import { FEATURES, type FeatureKey } from "@/modules/billing/domain/plans";
import { getSubscriptionOverview } from "@/modules/billing/application/subscription-service";
import { cancelSubscriptionAction, openPortalAction, resumeSubscriptionAction, simulatePeriodEndAction, startCheckoutAction } from "@/app/app/compte/abonnement/actions";

/** Subscription of one professional listing (audience "professional"). */
export default async function ProfessionalSubscriptionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ feature?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const actor = await requireActor(`/app/pro/${id}/abonnement`);
  let overview;
  try {
    overview = await getSubscriptionOverview(actor, "professional", id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const feature = sp.feature && sp.feature in FEATURES ? (sp.feature as FeatureKey) : null;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Fiche professionnelle" title="Abonnement de la fiche" description="L'offre Premium débloque la bibliothèque complète de templates, les outils métier, les statistiques et la synchronisation des calendriers." />
      <LiveBillingBanner show={!stripeConfigured || !overview.liveEnabled} />
      {feature && (
        <Card className="gap-1 border-primary/40 bg-accent/40 p-5" data-testid="feature-highlight">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Fonctionnalité demandée</p>
          <p className="font-medium">{FEATURES[feature]}</p>
        </Card>
      )}
      <SubscriptionCard overview={overview} actions={{ cancel: cancelSubscriptionAction, resume: resumeSubscriptionAction, portal: openPortalAction, simulateEnd: simulatePeriodEndAction }} />
      <section className="space-y-4" aria-labelledby="comparatif">
        <h2 id="comparatif" className="text-xl font-semibold">
          Comparatif des offres professionnelles
        </h2>
        <PlanComparison
          plans={overview.plans}
          currentPlanKey={overview.effective.planKey}
          highlightFeature={feature}
          renderCta={(plan) => {
            if (plan.priceMonthlyCents === 0 || plan.key === overview.effective.planKey) return null;
            if (overview.subscription && !overview.subscription.cancelAtPeriodEnd) return <p className="text-sm text-muted-foreground">Résiliez l'offre actuelle avant d'en changer.</p>;
            return (
              <ActionForm action={startCheckoutAction} className="space-y-2">
                <input type="hidden" name="planKey" value={plan.key} />
                <input type="hidden" name="audience" value="professional" />
                <input type="hidden" name="professionalId" value={id} />
                <div className="space-y-1">
                  <Label htmlFor={`promo-${plan.key}`} className="text-xs">
                    Code promo (facultatif)
                  </Label>
                  <Input id={`promo-${plan.key}`} name="promoCode" placeholder="BIENVENUE20" autoComplete="off" className="uppercase" />
                </div>
                <ActionSubmit className="w-full" pendingLabel="Redirection…">
                  Souscrire pour {formatEuros(plan.priceMonthlyCents)} / mois
                </ActionSubmit>
              </ActionForm>
            );
          }}
        />
      </section>
    </div>
  );
}
