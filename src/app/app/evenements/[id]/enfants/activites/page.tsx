import Link from "next/link";
import { ArrowLeft, CalendarDays, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionDialog } from "@/components/childcare/action-form";
import { requireActor } from "@/lib/session";
import { getEventAccess } from "@/modules/authorization";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { formatDateTime, formatTime } from "@/modules/calendar/domain/datetime";
import { listActivities } from "@/modules/childcare/application/activities-service";
import { guardPage } from "@/components/childcare/page-guard";
import { createActivityAction, deleteActivityAction } from "../actions";

export const metadata = { title: "Programme d'activités — Sous Nos Ailes" };

export default async function ActivitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const actor = await requireActor(`/app/evenements/${eventId}/enfants/activites`);
  const { activities, timezone, canManage } = await guardPage(async () => {
    const [activities, timezone, access] = await Promise.all([listActivities(actor, eventId), getUserTimezone(actor.userId), getEventAccess(actor, eventId)]);
    return { activities, timezone, canManage: Boolean(access?.permissions.has("children.manage")) };
  });
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/app/evenements/${eventId}/enfants`}>
          <ArrowLeft className="size-4" aria-hidden="true" /> Enfants
        </Link>
      </Button>
      <PageHeader
        eyebrow="Garde d'enfants"
        title="Programme d'activités"
        description="Le déroulé de l'espace enfants : ateliers, goûter, sieste, spectacle. Visible par toute l'équipe de garde."
        actions={
          canManage && (
            <ActionDialog
              trigger={
                <Button size="sm">
                  <Plus className="size-4" aria-hidden="true" /> Ajouter une activité
                </Button>
              }
              title="Nouvelle activité"
              action={createActivityAction.bind(null, eventId)}
              successMessage="Activité ajoutée."
            >
              <div className="space-y-1.5">
                <Label htmlFor="act-title">Titre *</Label>
                <Input id="act-title" name="title" required maxLength={120} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="act-start">Début *</Label>
                  <Input id="act-start" name="startsAt" type="datetime-local" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="act-end">Fin</Label>
                  <Input id="act-end" name="endsAt" type="datetime-local" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="act-min">Âge min</Label>
                  <Input id="act-min" name="minAge" type="number" min={0} max={17} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="act-max">Âge max</Label>
                  <Input id="act-max" name="maxAge" type="number" min={0} max={17} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="act-loc">Lieu</Label>
                <Input id="act-loc" name="location" maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="act-desc">Description</Label>
                <Textarea id="act-desc" name="description" rows={3} maxLength={2000} />
              </div>
            </ActionDialog>
          )
        }
      />
      {activities.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Aucune activité planifiée" description="Ajoutez les temps forts de l'espace enfants pour que l'équipe s'organise." />
      ) : (
        <ol className="space-y-3">
          {activities.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-4 rounded-2xl border bg-card p-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold tracking-wider text-primary uppercase">
                  {formatDateTime(a.startsAt, timezone)}
                  {a.endsAt ? ` → ${formatTime(a.endsAt, timezone)}` : ""}
                </div>
                <h3 className="font-semibold">{a.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {[a.location, a.minAge !== null || a.maxAge !== null ? `${a.minAge ?? 0}–${a.maxAge ?? 17} ans` : null].filter(Boolean).join(" · ")}
                </p>
                {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
              </div>
              {canManage && (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon-xs" aria-label={`Supprimer ${a.title}`}>
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  }
                  title="Supprimer cette activité ?"
                  description={a.title}
                  onConfirm={deleteActivityAction.bind(null, eventId, a.id)}
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
