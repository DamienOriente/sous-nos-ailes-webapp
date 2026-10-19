import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { KidsCornerScene } from "@/components/illustrations";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ActionDialog } from "@/components/childcare/action-form";
import { ChildFormFields } from "@/components/childcare/child-form-fields";
import { RosterTable } from "@/components/childcare/roster-table";
import { requireActor } from "@/lib/session";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { getPresenceDashboard } from "@/modules/childcare/application/attendance-service";
import { listChildren } from "@/modules/childcare/application/children-service";
import { guardPage } from "@/components/childcare/page-guard";
import { createChildAction, quickAttendanceAction } from "./actions";

export const metadata = { title: "Garde d'enfants" };

export default async function ChildrenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const actor = await requireActor(`/app/evenements/${eventId}/enfants`);
  const { scope, children, dashboard, timezone } = await guardPage(async () => {
    const [{ scope, children }, dashboard, timezone] = await Promise.all([listChildren(actor, eventId), getPresenceDashboard(actor, eventId), getUserTimezone(actor.userId)]);
    return { scope, children, dashboard, timezone };
  });
  const perms = scope.access.permissions;
  const canManage = perms.has("children.manage");
  const canRecord = perms.has("children.record_attendance");
  const scoped = scope.assignedChildIds !== null;
  const createAction = createChildAction.bind(null, eventId);
  const checkIn = async (childId: string) => {
    "use server";
    return quickAttendanceAction(eventId, childId, "check_in");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={scoped ? "Mes enfants" : "Enfants accueillis"}
        description={
          scoped
            ? "Les enfants qui vous sont affectés pour cet évènement. Les informations de santé se consultent avec un motif, après consentement du responsable légal."
            : "Liste des enfants, équipe de garde, présences et remises. Les données sont minimisées : âge sans date de naissance, santé chiffrée et journalisée."
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/evenements/${eventId}/enfants/procedure`}>
                 Procédure d'urgence
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/evenements/${eventId}/enfants/activites`}>
                 Programme
              </Link>
            </Button>
            {perms.has("children.assign_staff") && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/evenements/${eventId}/enfants/equipe`}>
                   Équipe
                </Link>
              </Button>
            )}
            {perms.has("children.view_access_logs") && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/evenements/${eventId}/enfants/journal`}>
                   Journal d'accès
                </Link>
              </Button>
            )}
            {canManage && children.length > 0 && (
              <ActionDialog
                trigger={
                  <Button size="sm">
                     Ajouter un enfant
                  </Button>
                }
                title="Nouvel enfant"
                description="Renseignez uniquement ce qui est nécessaire à la garde. Pensez à informer le responsable légal (texte prêt à envoyer sur la fiche de l'enfant)."
                action={createAction}
                submitLabel="Ajouter"
                successMessage="Enfant ajouté."
                wide
              >
                <ChildFormFields timezone={timezone} />
              </ActionDialog>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="presence-dashboard">
        <StatCard label="Enfants" value={dashboard.total} />
        <StatCard label="Présents" value={dashboard.present} />
        <StatCard label="Attendus" value={dashboard.expected} />
        <StatCard label="Partis" value={dashboard.left} hint={dashboard.incidents ? `${dashboard.incidents} incident(s) consigné(s)` : undefined} />
      </div>

      {children.length === 0 ? (
        <IllustratedEmpty
          scene={KidsCornerScene}
          title={scoped ? "Aucun enfant ne vous est affecté" : "Aucun enfant inscrit pour l'instant"}
          description={scoped ? "L'organisateur ou le responsable de la garde vous affectera les enfants dont vous aurez la charge ; vous verrez alors leurs consignes et pourrez pointer les arrivées." : "Inscrivez les enfants attendus avec ce qui est nécessaire à la garde : âge, responsable légal, consignes, personnes autorisées à les récupérer. Les informations de santé restent chiffrées et chaque consultation est journalisée."}
          example="Léa, 6 ans, arrivée à 15:30, départ à 23:00, récupérée par sa mère ou son père"
          action={canManage ? <ActionDialog trigger={<Button size="sm">Ajouter un enfant</Button>} title="Nouvel enfant" description="Renseignez uniquement ce qui est nécessaire à la garde. Pensez à informer le responsable légal (texte prêt à envoyer sur la fiche de l'enfant)." action={createAction} submitLabel="Ajouter" successMessage="Enfant ajouté." wide><ChildFormFields timezone={timezone} /></ActionDialog> : undefined}
          testId="children-empty"
        />
      ) : (
        <RosterTable eventId={eventId} rows={children} timezone={timezone} canRecordAttendance={canRecord} onCheckIn={canRecord ? checkIn : undefined} />
      )}
    </div>
  );
}
