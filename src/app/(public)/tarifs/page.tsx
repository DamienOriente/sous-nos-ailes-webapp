import type { Metadata } from "next";
import Link from "next/link";
import { BillingFaq } from "@/components/billing/billing-faq";
import { LiveBillingBanner } from "@/components/billing/live-billing-banner";
import { PlanComparison } from "@/components/billing/plan-comparison";
import { Container, Section } from "@/components/shared/section";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { stripeConfigured } from "@/lib/env";
import { getActor } from "@/lib/session";
import { getSetting } from "@/modules/admin/application/settings-service";
import { listPlans } from "@/modules/billing/application/subscription-service";
import { loadAgencyPlan } from "@/modules/billing/application/agency-holds";
import { AgencyTiers } from "@/components/billing/agency-tiers";

export const metadata: Metadata = { title: "Tarifs", description: "Offres gratuites et payantes pour les organisateurs d'évènements et pour les professionnels. Sans engagement, résiliables en ligne." };

export default async function PricingPage() {
  const [organizerPlans, professionalPlans, liveEnabled, actor, agencyPlan] = await Promise.all([listPlans("organizer"), listPlans("professional"), getSetting<boolean>("billing.live_enabled", false), getActor(), loadAgencyPlan()]);
  const showBanner = !stripeConfigured || !liveEnabled;
  const renderPlanCta = (audience: "organizer" | "professional", plan: { key: string; priceMonthlyCents: number }) => {
    if (plan.priceMonthlyCents === 0) {
      return (
        <Button asChild variant="outline" className="w-full">
          <Link href={actor ? "/app" : "/inscription"}>{actor ? "Accéder à mon espace" : "Commencer gratuitement"}</Link>
        </Button>
      );
    }
    const href = actor ? (audience === "organizer" ? `/app/compte/abonnement?plan=${plan.key}` : `/app/compte/abonnement?audience=professional&plan=${plan.key}`) : `/inscription?next=${encodeURIComponent("/app/compte/abonnement")}`;
    return (
      <Button asChild className="w-full">
        <Link href={href}>Choisir cette offre</Link>
      </Button>
    );
  };
  return (
    <>
      <Section className="pb-0 sm:pb-0">
        <Container className="space-y-8">
          <PageHeader title="Tarifs" description="L'essentiel est gratuit : organiser un évènement ou publier une fiche. Les offres payantes ajoutent des outils, sans engagement, et se résilient en ligne à tout moment." />
          <LiveBillingBanner show={showBanner} />
        </Container>
      </Section>
      <Section id="organisateurs">
        <Container className="space-y-8">
          <h2 className="text-2xl font-semibold">Pour les organisateurs</h2>
          <PlanComparison plans={organizerPlans} renderCta={(plan) => renderPlanCta("organizer", plan)} />
        </Container>
      </Section>
      <Section className="pt-0 sm:pt-0" id="professionnels">
        <Container className="space-y-8">
          <h2 className="text-2xl font-semibold">Pour les professionnels</h2>
          <PlanComparison plans={professionalPlans} renderCta={(plan) => renderPlanCta("professional", plan)} />
          <p className="text-sm text-muted-foreground text-pretty">
            Les emplacements sponsorisés inclus dans l'offre Premium sont toujours étiquetés « Sponsorisé », limités en nombre et ne contournent jamais la modération.{" "}
            <Link href="/classements-sponsorises" className="underline">
              Comprendre les classements sponsorisés
            </Link>
            .
          </p>
        </Container>
      </Section>
      {agencyPlan && agencyPlan.tiers.length > 0 && (
        <Section className="pt-0 sm:pt-0" id="agences">
          <Container className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Agences et structures à plusieurs activités</h2>
              <p className="leading-7 text-muted-foreground text-pretty">
                Un indépendant publie une fiche, et y ajoute ses autres métiers comme métiers secondaires. Une société, une association ou un organisme public qui gère plusieurs activités distinctes peut faire valider sa structure comme agence, puis publier une fiche par activité.
              </p>
              <p className="leading-7 text-muted-foreground text-pretty">
                La première fiche est incluse. Chaque fiche suivante est facturée chaque mois, à un prix qui baisse avec le nombre de fiches. Le montant suit vos fiches en relecture ou en ligne, au prorata. L'offre Premium reste une option de chaque fiche.
              </p>
              <Button asChild variant="outline">
                <Link href={actor ? "/app/pro/structure" : `/inscription?intent=professional&next=${encodeURIComponent("/app/pro/structure")}`}>Demander le statut agence</Link>
              </Button>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <AgencyTiers tiers={agencyPlan.tiers} />
            </div>
          </Container>
        </Section>
      )}
      <Section className="pt-0 sm:pt-0" id="faq">
        <Container size="narrow" className="space-y-8">
          <h2 className="text-2xl font-semibold">Questions sur la facturation</h2>
          <BillingFaq />
          <p className="text-sm text-muted-foreground">
            Paiement par Stripe. Conditions détaillées dans les{" "}
            <Link href="/cgv" className="underline">
              CGV
            </Link>
            .
          </p>
        </Container>
      </Section>
    </>
  );
}
