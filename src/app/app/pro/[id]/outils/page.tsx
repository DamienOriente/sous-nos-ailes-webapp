import type { Metadata } from "next";
import { Paywall } from "@/components/billing/paywall";
import { PageHeader } from "@/components/shared/page-header";
import { ToolCard } from "@/components/professionals/tool-card";
import { requireActor } from "@/lib/session";
import { listToolsForListing } from "@/modules/tools/application/tool-service";
import { setToolEnabledAction } from "./actions";

export const metadata: Metadata = { title: "Outils métier" };

export default async function ToolsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/pro/${id}/outils`);
  const tools = await listToolsForListing(actor, id);
  const free = tools.filter((t) => t.entitled);
  const locked = tools.filter((t) => !t.entitled);
  return (
    <div className="space-y-8">
      <PageHeader title="Outils métier" description="Les outils proposés dépendent de votre métier et de votre offre. Activez ceux que vous utilisez : ils apparaissent dans vos évènements et votre espace." />
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Disponibles</h2>
        <div className="grid gap-3 sm:grid-cols-2" data-testid="tools-available">
          {free.map((t) => (
            <ToolCard key={t.key} tool={t} professionalId={id} onToggle={setToolEnabledAction} />
          ))}
        </div>
      </section>
      {locked.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Inclus dans Professionnel Premium</h2>
          <div className="grid gap-3 sm:grid-cols-2" data-testid="tools-locked">
            {locked.map((t) => (
              <ToolCard key={t.key} tool={t} professionalId={id} onToggle={setToolEnabledAction} />
            ))}
          </div>
          <Paywall feature="tools.premium" audience="professional" description="Statistiques détaillées, assistant SEO et outils avancés de gestion commerciale pour développer votre activité." backHref={`/app/pro/${id}`} backLabel="Retour au tableau de bord" />
        </section>
      )}
    </div>
  );
}
