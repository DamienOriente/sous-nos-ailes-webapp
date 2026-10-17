import Link from "next/link";
import { Store } from "lucide-react";
import { LiveBillingBanner } from "@/components/billing/live-billing-banner";
import { PlanChanges } from "@/components/billing/plan-changes";
import { PlanComparison } from "@/components/billing/plan-comparison";
import { SubscriptionCard } from "@/components/billing/subscription-card";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stripeConfigured } from "@/lib/env";
import { requireActor } from "@/lib/session";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { FEATURES, type FeatureKey } from "@/modules/billing/domain/plans";
import { SUBSCRIPTION_STATUS_LABELS, type SubscriptionStatus } from "@/modules/billing/domain/subscription-status";
import { getSubscriptionOverview, listInvoices, listManageableProfessionals } from "@/modules/billing/application/subscription-service";
import { cancelSubscriptionAction, openPortalAction, resumeSubscriptionAction, simulatePeriodEndAction, startCheckoutAction } from "./actions";

type Search = { feature?: string; audience?: string; plan?: string; checkout?: string };

export default async function AccountSubscriptionPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requireActor("/app/compte/abonnement");
  const sp = await searchParams;
  const feature = sp.feature && sp.feature in FEATURES ? (sp.feature as FeatureKey) : null;

  if (sp.audience === "professional") {
    const listings = await listManageableProfessionals(actor);
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Abonnement" title="Offre professionnelle" description="L'offre Premium s'applique à une fiche professionnelle. Choisissez la fiche concernée." />
        {listings.length === 0 ? (
          <EmptyState icon={Store} title="Aucune fiche professionnelle" description="Créez d'abord votre fiche pour accéder aux offres professionnelles." action={<Button asChild><Link href="/onboarding">Créer ma fiche</Link></Button>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {listings.map((l) => (
              <Card key={l.id} className="gap-2 p-5">
                <p className="font-medium">{l.displayName}</p>
                <Button asChild variant="outline">
                  <Link href={`/app/pro/${l.id}/abonnement${feature ? `?feature=${feature}` : ""}`}>Gérer l'abonnement de cette fiche</Link>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  const [overview, invoices] = await Promise.all([getSubscriptionOverview(actor, "organizer"), listInvoices(actor)]);
  const paidPlans = overview.plans.filter((p) => p.priceMonthlyCents > 0);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Mon compte" title="Abonnement" description="Votre offre actuelle, le comparatif et l'historique de facturation." />
      <LiveBillingBanner show={!stripeConfigured || !overview.liveEnabled} />
      {sp.checkout === "cancelled" && (
        <p role="status" className="rounded-lg bg-muted px-4 py-3 text-sm">
          Paiement annulé : aucun changement n'a été effectué sur votre compte.
        </p>
      )}
      {feature && (
        <Card className="gap-1 border-primary/40 bg-accent/40 p-5" data-testid="feature-highlight">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Fonctionnalité demandée</p>
          <p className="font-medium">{FEATURES[feature]}</p>
          <p className="text-sm text-muted-foreground">Cette fonctionnalité est incluse dans {paidPlans.map((p) => p.name).join(" / ") || "l'offre Premium"}. Le comparatif ci-dessous la met en évidence.</p>
        </Card>
      )}
      <SubscriptionCard overview={overview} actions={{ cancel: cancelSubscriptionAction, resume: resumeSubscriptionAction, portal: openPortalAction, simulateEnd: simulatePeriodEndAction }} />

      <PlanChanges audience="organizer" plans={overview.plans} currentPlanKey={overview.effective.planKey} highlightFeature={feature} />

      <section className="space-y-4" aria-labelledby="comparatif">
        <h2 id="comparatif" className="text-xl font-semibold">
          Comparatif des offres
        </h2>
        <PlanComparison
          plans={overview.plans}
          currentPlanKey={overview.effective.planKey}
          highlightFeature={feature}
          renderCta={(plan) => {
            if (plan.priceMonthlyCents === 0 || plan.key === overview.effective.planKey) return null;
            if (overview.subscription && !overview.subscription.cancelAtPeriodEnd) return <p className="text-sm text-muted-foreground">Résiliez votre offre actuelle avant d'en changer.</p>;
            return (
              <ActionForm action={startCheckoutAction} className="space-y-2">
                <input type="hidden" name="planKey" value={plan.key} />
                <input type="hidden" name="audience" value="organizer" />
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

      <section className="space-y-3" aria-labelledby="factures">
        <h2 id="factures" className="text-xl font-semibold">
          Factures
        </h2>
        {invoices.provider === "mock" ? (
          <p className="text-sm text-muted-foreground">Aucune facture : le paiement simulé ne génère pas de document comptable. Avec Stripe, vos factures apparaîtront ici et seront envoyées par e-mail.</p>
        ) : invoices.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune facture pour le moment.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {invoices.invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  {formatDateFr(inv.createdAt)} — {inv.number ?? inv.id}
                </span>
                <span className="font-medium">{formatEuros(inv.amountPaidCents)}</span>
                {inv.hostedUrl && (
                  <a href={inv.hostedUrl} className="underline" target="_blank" rel="noopener noreferrer">
                    Voir la facture
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {overview.history.length > 1 && (
        <section className="space-y-3" aria-labelledby="historique">
          <h2 id="historique" className="text-xl font-semibold">
            Historique des abonnements
          </h2>
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {overview.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>{h.planName}</span>
                <span className="text-muted-foreground">{SUBSCRIPTION_STATUS_LABELS[h.status as SubscriptionStatus]}</span>
                <span className="text-muted-foreground">
                  {formatDateFr(h.createdAt)}
                  {h.endedAt ? ` → ${formatDateFr(h.endedAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
