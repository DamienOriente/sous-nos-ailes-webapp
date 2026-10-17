import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
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
      <ServicesManager professionalId={id} services={services} saveAction={saveServiceAction} deleteAction={deleteServiceAction} moveAction={moveServiceAction} />
    </div>
  );
}
