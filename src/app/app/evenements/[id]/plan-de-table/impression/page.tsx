import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/invitations/print-button";
import { SeatingPrint } from "@/components/seating/seating-print";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { assertSeatingEntitlement, getSeatingPlan } from "@/modules/seating/application/seating-service";

export default async function SeatingPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/plan-de-table/impression`);
  let plan;
  try {
    await assertSeatingEntitlement(id);
    plan = await getSeatingPlan(actor, id);
  } catch (e) {
    if (isAppError(e)) notFound();
    throw e;
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/app/evenements/${id}/plan-de-table`}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Retour au plan
          </Link>
        </Button>
        <PrintButton label="Imprimer le plan" />
      </div>
      <SeatingPrint plan={plan} />
    </div>
  );
}
