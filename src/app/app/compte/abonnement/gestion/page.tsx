import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requireActor } from "@/lib/session";

/** Mock replacement for the Stripe billing portal. */
export default async function MockPortalPage() {
  await requireActor("/app/compte/abonnement");
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader eyebrow="Démonstration" title="Portail de gestion simulé" description="Avec Stripe configuré, ce bouton ouvre le portail client Stripe : moyen de paiement, factures, résiliation." />
      <Card className="space-y-3 p-6 text-sm">
        <p>Dans cet environnement, la gestion se fait directement depuis la page Abonnement : résiliation à l'échéance, reprise et simulation de fin de période.</p>
        <p>
          <Link href="/app/compte/abonnement" className="underline">
            Retour à l'abonnement
          </Link>
        </p>
      </Card>
    </div>
  );
}
