import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ServiceExample } from "@/components/pages/workspace/examples";
import { IllustratedEmpty } from "@/components/pages/workspace/illustrated-empty";
import { ServicesManager } from "@/components/professionals/service-form";
import { requireActor } from "@/lib/session";
import { listServices } from "@/modules/professionals/application/services-service";
import { deleteServiceAction, moveServiceAction, saveServiceAction } from "./actions";

export const metadata: Metadata = { title: "Prestations" };

export default async function ServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/pro/${id}/prestations`);
  const services = await listServices(actor, id);
  return (
    <div className="space-y-6">
      <PageHeader title="Prestations" description="Décrivez ce que vous proposez : les organisateurs filtrent et comparent sur ces prestations. L'ordre d'affichage est celui de la liste." />
      {services.length === 0 && <IllustratedEmpty title="Aucune prestation pour l'instant" description="Les organisateurs filtrent l'annuaire et comparent les fiches sur les prestations et leurs tarifs « à partir de ». Ajoutez-en au moins trois : la plus demandée, la plus complète, la plus accessible." />}
      <ServicesManager professionalId={id} services={services} saveAction={saveServiceAction} deleteAction={deleteServiceAction} moveAction={moveServiceAction} />
      <ServiceExample />
    </div>
  );
}
