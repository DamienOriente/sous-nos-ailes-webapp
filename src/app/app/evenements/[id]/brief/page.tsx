import type { Metadata } from "next";
import Link from "next/link";
import { BriefCard } from "@/components/brief/brief-card";
import { BriefSendForm } from "@/components/brief/brief-send-form";
import { ActionForm, FieldErrorText } from "@/components/professionals/action-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireActor } from "@/lib/session";
import { getEventForMember } from "@/modules/events/application/event-service";
import { getBriefPage } from "@/modules/events/application/brief-service";
import { guardPage } from "../_guards";
import { sendBriefAction, updateBriefAction } from "./actions";

export const metadata: Metadata = { title: "Brief de l'évènement" };

/** Describe the event once, send the same brief to every provider. */
export default async function EventBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/brief`);
  const data = await guardPage(() => getBriefPage(actor, id));
  const event = await getEventForMember(actor, id);
  const canEdit = event.access.permissions.has("event.edit");
  const canSend = event.access.permissions.has("event.providers.manage");
  const e = data.event;
  return (
    <div className="space-y-8">
      <PageHeader title="Brief de l'évènement" description="Décrivez l'évènement une fois. Chaque professionnel contacté depuis cet espace reçoit ce brief tel quel : plus besoin de tout réexpliquer." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:items-start">
        {canEdit ? (
          <Card className="p-5 sm:p-6">
            <ActionForm action={updateBriefAction.bind(null, id)} submitLabel="Enregistrer le brief" successMessage="Brief enregistré.">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eventDate">Date</Label>
                  <Input id="eventDate" name="eventDate" type="date" defaultValue={e.eventDate ?? ""} />
                  <FieldErrorText name="eventDate" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="style">Style ou ambiance</Label>
                  <Input id="style" name="style" maxLength={160} defaultValue={e.style ?? ""} placeholder="Champêtre chic, couleurs sauge et ivoire" />
                  <FieldErrorText name="style" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="venueName">Lieu</Label>
                  <Input id="venueName" name="venueName" maxLength={160} defaultValue={e.venueName ?? ""} placeholder="Nom du domaine ou de la salle" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Code postal</Label>
                  <Input id="postalCode" name="postalCode" inputMode="numeric" defaultValue={e.postalCode ?? ""} />
                  <FieldErrorText name="postalCode" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input id="city" name="city" defaultValue={e.city ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedGuests">Nombre d'invités</Label>
                  <Input id="expectedGuests" name="expectedGuests" type="number" min={0} defaultValue={e.expectedGuests ?? ""} />
                  <FieldErrorText name="expectedGuests" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedChildren">Dont enfants</Label>
                  <Input id="expectedChildren" name="expectedChildren" type="number" min={0} defaultValue={e.expectedChildren ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budgetEuros">Budget indicatif (€)</Label>
                  <Input id="budgetEuros" name="budgetEuros" type="number" min={0} step="100" defaultValue={e.budgetCents !== null ? Math.round(e.budgetCents / 100) : ""} />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" name="briefShareBudget" defaultChecked={e.briefShareBudget} className="size-4" />
                  Envoyer le budget aux professionnels
                </label>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="preferences">Besoins et précisions</Label>
                  <Textarea id="preferences" name="preferences" rows={5} maxLength={3000} defaultValue={e.preferences ?? ""} placeholder="Ce que vous attendez, les contraintes du lieu, les horaires, ce qui compte le plus pour vous." />
                </div>
              </div>
            </ActionForm>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Seuls les organisateurs modifient le brief.</p>
        )}
        <div className="space-y-3">
          <BriefCard brief={data.brief} title="Ce que reçoivent les professionnels" />
          {data.missing.length > 0 && <p className="text-sm text-pretty">Pour des réponses précises, ajoutez {data.missing.join(", ")}.</p>}
        </div>
      </div>

      {canSend && (
        <section aria-labelledby="send-h" className="space-y-4">
          <div>
            <h2 id="send-h" className="text-xl font-semibold">
              Envoyer le brief
            </h2>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Les professionnels de la liste de l'évènement et vos favoris. {e.eventDate ? "Leur disponibilité à la date de l'évènement est vérifiée sur leur agenda." : "Renseignez la date pour voir qui est libre."}
            </p>
          </div>
          {data.targets.length === 0 ? (
            <EmptyState
              title="Personne à contacter pour l'instant"
              description="Ajoutez des professionnels en favoris depuis l'annuaire, ou à la liste des prestataires de l'évènement, puis revenez ici."
              action={
                <Link href={e.eventDate ? `/annuaire?date=${e.eventDate}` : "/annuaire"} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                  {e.eventDate ? "Voir les professionnels libres à la date" : "Ouvrir l'annuaire"}
                </Link>
              }
            />
          ) : (
            <Card className="p-5 sm:p-6">
              <BriefSendForm
                hasDate={Boolean(e.eventDate)}
                action={sendBriefAction.bind(null, id)}
                targets={data.targets.map((t) => ({ professionalId: t.professionalId, displayName: t.displayName, categoryName: t.categoryName, source: t.source, openInquiryStatus: t.openInquiryStatus, available: t.availability?.available ?? null, reason: t.availability?.reason ?? null }))}
              />
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
