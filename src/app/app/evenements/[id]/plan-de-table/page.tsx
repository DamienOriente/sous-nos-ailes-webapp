import { notFound } from "next/navigation";
import { Paywall } from "@/components/billing/paywall";
import { PageHeader } from "@/components/shared/page-header";
import { SeatingEditor } from "@/components/seating/seating-editor";
import { SeatingStaticPreview } from "@/components/seating/seating-static-preview";
import { isAppError, PaymentRequiredError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { can, requireEventPermission } from "@/modules/authorization";
import { assertSeatingEntitlement, getSeatingPlan } from "@/modules/seating/application/seating-service";
import { assignGuestAction, createTableAction, deleteTableAction, moveTableAction, unassignGuestAction, updateTableAction } from "./actions";

export const metadata = { title: "Plan de table — Sous Nos Ailes" };

export default async function SeatingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/plan-de-table`);
  let access;
  try {
    access = await requireEventPermission(actor, id, "event.seating.view");
  } catch (e) {
    if (isAppError(e)) notFound();
    throw e;
  }
  try {
    await assertSeatingEntitlement(id);
  } catch (e) {
    if (e instanceof PaymentRequiredError) {
      return (
        <div className="space-y-6">
          <PageHeader eyebrow="Évènement" title="Plan de table" />
          <Paywall feature="seating_plan" audience="organizer" description="Placez vos tables sur un plan interactif (souris, tactile ou clavier), affectez les invités par glisser-déposer ou par sélecteur, suivez les places libres, imprimez le plan et la liste par table ou exportez-les en PDF." backHref={`/app/evenements/${id}`} backLabel="Retour à l'évènement" preview={<SeatingStaticPreview />} />
        </div>
      );
    }
    throw e;
  }
  const plan = await getSeatingPlan(actor, id);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Évènement" title="Plan de table" description="Déplacez les tables sur le plan (souris, tactile, flèches du clavier) ou saisissez leurs coordonnées. Affectez les invités par glisser-déposer ou via « Placer à… »." />
      <SeatingEditor eventId={id} plan={plan} canManage={can(access, "event.seating.manage")} actions={{ createTable: createTableAction, updateTable: updateTableAction, deleteTable: deleteTableAction, moveTable: moveTableAction, assignGuest: assignGuestAction, unassignGuest: unassignGuestAction }} />
    </div>
  );
}
