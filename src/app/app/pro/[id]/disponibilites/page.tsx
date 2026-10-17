import type { Metadata } from "next";
import Link from "next/link";
import { CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ActionForm } from "@/components/professionals/action-form";
import { AvailabilityGrid } from "@/components/professionals/availability-grid";
import { requireActor } from "@/lib/session";
import { listAvailability } from "@/modules/professionals/application/availability-service";
import { saveAvailabilityAction } from "./actions";

export const metadata: Metadata = { title: "Disponibilités" };

export default async function AvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/pro/${id}/disponibilites`);
  const slots = await listAvailability(actor, id);
  return (
    <div className="space-y-6">
      <PageHeader title="Disponibilités" description="Vos créneaux habituels. L'annuaire utilise cette grille quand un organisateur filtre sur une date : sans grille, vous êtes considéré disponible tous les jours." />
      <Card>
        <CardHeader>
          <CardTitle>Grille hebdomadaire</CardTitle>
          <CardDescription>Cochez les créneaux où vous acceptez des prestations.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={saveAvailabilityAction} submitLabel="Enregistrer mes disponibilités" successMessage="Disponibilités enregistrées.">
            <input type="hidden" name="professionalId" value={id} />
            <AvailabilityGrid slots={slots} />
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="size-4" aria-hidden="true" />
            Indisponibilités ponctuelles
          </CardTitle>
          <CardDescription>Congés, dates déjà réservées : ajoutez-les dans votre calendrier (type « indisponibilité »). Elles vous retirent des résultats pour ces dates.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={`/app/calendrier?professional=${id}`}>Ouvrir mon calendrier</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
