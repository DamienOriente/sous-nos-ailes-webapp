import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { AssignmentMatrix } from "@/components/childcare/assignment-matrix";
import { requireActor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { listCareTeam } from "@/modules/childcare/application/assignments-service";
import { listChildren } from "@/modules/childcare/application/children-service";
import { guardPage } from "@/components/childcare/page-guard";
import { assignChildAction, unassignChildAction } from "../actions";

export const metadata = { title: "Équipe de garde — Sous Nos Ailes" };

export default async function CareTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const actor = await requireActor(`/app/evenements/${eventId}/enfants/equipe`);
  const { children, team } = await guardPage(async () => {
    await requireEventPermission(actor, eventId, "children.assign_staff");
    const [{ children }, team] = await Promise.all([listChildren(actor, eventId), listCareTeam(actor, eventId)]);
    return { children, team };
  });
  const assign = async (childId: string, memberId: string, allow: boolean) => {
    "use server";
    return assignChildAction(eventId, childId, memberId, allow);
  };
  const unassign = async (childId: string, memberId: string) => {
    "use server";
    return unassignChildAction(eventId, childId, memberId);
  };
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/app/evenements/${eventId}/enfants`}>
          <ArrowLeft className="size-4" aria-hidden="true" /> Enfants
        </Link>
      </Button>
      <PageHeader
        eyebrow="Garde d'enfants"
        title="Équipe et affectations"
        description="Chaque intervenant ne voit que les enfants qui lui sont affectés. Les prestataires de garde d'enfants sont proposés en premier ; les autres membres nécessitent une confirmation."
      />
      {team.length === 0 ? (
        <EmptyState icon={Users} title="Aucun intervenant éligible" description="Ajoutez un prestataire de garde d'enfants ou du personnel opérationnel à l'évènement pour pouvoir l'affecter." />
      ) : children.length === 0 ? (
        <EmptyState icon={Users} title="Aucun enfant à affecter" description="Enregistrez d'abord les enfants attendus." />
      ) : (
        <AssignmentMatrix rows={children} team={team} onAssign={assign} onUnassign={unassign} />
      )}
    </div>
  );
}
