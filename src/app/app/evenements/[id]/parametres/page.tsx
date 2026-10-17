import Link from "next/link";
import { Download } from "lucide-react";
import { EventSettingsForm, EventStatusPanel, DeleteEventPanel } from "@/components/events/settings-forms";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/lib/session";
import { getEventWithPermission } from "@/modules/events/application/event-service";
import { guardPage } from "../_guards";
import { changeStatusAction, deleteEventAction, updateEventAction } from "./actions";

function localTime(d: Date | null, timeZone: string): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).replace("h", ":");
}

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/parametres`);
  const event = await guardPage(() => getEventWithPermission(actor, id, "event.edit"));
  const isOwner = event.ownerUserId === actor.userId;
  const base = `/app/evenements/${id}/parametres`;
  return (
    <div className="space-y-8">
      <PageHeader title="Paramètres" description="Informations de l'évènement, statut et cycle de vie." />
      {event.status === "completed" && (
        <Card className="border-success/40">
          <CardHeader>
            <CardTitle>Évènement terminé</CardTitle>
            <CardDescription>Exportez vos données, conservez l'espace en lecture ou fermez-le. Les données des enfants sont anonymisées automatiquement après le délai prévu.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(["tasks", "budget", "providers"] as const).map((k) => (
              <Button key={k} asChild variant="outline" size="sm">
                <a href={`${base}/export?kind=${k}`}>
                  <Download className="size-3.5" aria-hidden="true" />
                  {k === "tasks" ? "Tâches (CSV)" : k === "budget" ? "Budget (CSV)" : "Prestataires (CSV)"}
                </a>
              </Button>
            ))}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/app/evenements/${id}`}>Conserver l'espace</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>Nom, type, date et lieu. La date met à jour le compte à rebours et le calendrier du propriétaire.</CardDescription>
        </CardHeader>
        <CardContent>
          <EventSettingsForm
            eventId={id}
            value={{
              name: event.name,
              type: event.type,
              description: event.description,
              eventDate: event.eventDate,
              dateIsTentative: event.dateIsTentative,
              startTime: localTime(event.startsAt, event.timezone),
              endTime: localTime(event.endsAt, event.timezone),
              timezone: event.timezone,
              venueName: event.venueName,
              addressLine1: event.addressLine1,
              postalCode: event.postalCode,
              city: event.city,
              expectedGuests: event.expectedGuests,
              expectedChildren: event.expectedChildren,
              budgetCents: event.budgetCents,
              preferences: event.preferences,
            }}
            action={updateEventAction}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Statut</CardTitle>
          <CardDescription>En préparation → confirmé → en cours → terminé. Annulation et archivage possibles à tout moment.</CardDescription>
        </CardHeader>
        <CardContent>
          <EventStatusPanel eventId={id} status={event.status} canArchive={isOwner || event.access.permissions.has("event.delete")} action={changeStatusAction} />
        </CardContent>
      </Card>
      {isOwner && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Supprimer l'évènement</CardTitle>
            <CardDescription>Suppression logique immédiate : plus personne n'y accède. Réservé au propriétaire ; l'action est journalisée.</CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteEventPanel eventId={id} eventName={event.name} action={deleteEventAction} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
