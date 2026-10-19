import { CheckoutReturnPoller } from "@/components/billing/checkout-return-poller";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requireActor } from "@/lib/session";
import { checkSubscriptionStateAction } from "../actions";

type Search = { session_id?: string; audience?: string; professionalId?: string; mock?: string; feature?: string };

/** Return from checkout: the URL proves nothing; the real state is polled server side. */
export default async function CheckoutReturnPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireActor("/app/compte/abonnement");
  const sp = await searchParams;
  const audience = sp.audience === "professional" ? "professional" : "organizer";
  const professionalId = sp.professionalId && /^[0-9a-f-]{36}$/i.test(sp.professionalId) ? sp.professionalId : null;
  const manageHref = audience === "professional" && professionalId ? `/app/pro/${professionalId}/abonnement` : "/app/compte/abonnement";
  const check = checkSubscriptionStateAction.bind(null, audience, professionalId);
  if (sp.mock === "failure") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeader title="Paiement refusé (simulation)" />
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Le paiement simulé a échoué : aucun abonnement n'a été créé et vos droits sont inchangés.</p>
          <a href={manageHref} className="mt-4 inline-block underline">
            Retour à l'abonnement
          </a>
        </Card>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Retour du paiement" />
      <Card className="p-8">
        <CheckoutReturnPoller check={check} manageHref={manageHref} targetHref={manageHref} targetLabel="Voir mon offre" />
      </Card>
      <p className="text-center text-xs text-muted-foreground">L'activation repose sur la confirmation du prestataire de paiement, jamais sur le simple retour de votre navigateur.</p>
    </div>
  );
}
