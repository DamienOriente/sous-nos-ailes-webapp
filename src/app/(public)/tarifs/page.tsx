import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
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

export const metadata: Metadata = { title: "Tarifs — Sous Nos Ailes", description: "Offres gratuites et Premium pour les organisateurs d'évènements et les professionnels. Sans engagement, résiliable en ligne." };

export default async function PricingPage() {
  const [organizerPlans, professionalPlans, liveEnabled, actor] = await Promise.all([listPlans("organizer"), listPlans("professional"), getSetting<boolean>("billing.live_enabled", false), getActor()]);
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
      <Section className="pb-8">
        <Container className="space-y-6">
          <PageHeader eyebrow="Tarifs" title="Une offre claire, sans engagement" description="L'essentiel est gratuit pour organiser votre évènement ou publier votre fiche. Les offres payantes ajoutent les outils avancés ; vous les résiliez en ligne quand vous voulez." />
          <LiveBillingBanner show={showBanner} />
        </Container>
      </Section>
      <Section className="pt-0" id="organisateurs">
        <Container className="space-y-6">
          <h2 className="text-2xl font-semibold">Pour les organisateurs</h2>
          <PlanComparison plans={organizerPlans} renderCta={(plan) => renderPlanCta("organizer", plan)} />
        </Container>
      </Section>
      <Section className="pt-0" id="professionnels">
        <Container className="space-y-6">
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
      <Section className="pt-0" id="faq">
        <Container size="narrow" className="space-y-6">
          <h2 className="text-2xl font-semibold">Questions sur la facturation</h2>
          <BillingFaq />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" /> Paiement sécurisé par Stripe. Conditions détaillées dans les{" "}
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
