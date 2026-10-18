import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { ActionDialog, ActionForm } from "@/components/childcare/action-form";
import { guardPage } from "@/components/childcare/page-guard";
import { DeleteItemButton, ToolSection } from "@/components/trade-tools/tool-blocks";
import { requireActor } from "@/lib/session";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { formatDateTime } from "@/modules/calendar/domain/datetime";
import { getMusicOverview } from "@/modules/trade-tools/application/music-service";
import { addMomentAction, deleteMomentAction, saveBriefAction } from "./actions";

export const metadata = { title: "Brief musical" };

export default async function MusicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const actor = await requireActor(`/app/evenements/${eventId}/musique`);
  const { data, timezone } = await guardPage(async () => {
    const [data, timezone] = await Promise.all([getMusicOverview(actor, eventId), getUserTimezone(actor.userId)]);
    return { data, timezone };
  });
  const { brief, moments } = data;
  return (
    <div className="space-y-6">
      <PageHeader title="Musique" description="Brief musical partagé entre les organisateurs et le DJ / les musiciens : envies, interdits, moments clés, besoins techniques." />
      <div className="grid gap-6 lg:grid-cols-2">
        <ToolSection title="Brief">
          <ActionForm action={saveBriefAction.bind(null, eventId)} successMessage="Brief enregistré.">
            <div className="space-y-1.5">
              <Label htmlFor="preferences">Préférences et ambiance</Label>
              <Textarea id="preferences" name="preferences" rows={3} defaultValue={brief?.preferences ?? ""} placeholder="Soul / funk au cocktail, généraliste dansant en soirée…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forbidden">Interdits</Label>
              <Textarea id="forbidden" name="forbidden" rows={2} defaultValue={brief?.forbidden ?? ""} placeholder="Pas de Macarena, pas de musique à paroles pendant le dîner…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="playlistText">Playlist indicative (un titre par ligne)</Label>
              <Textarea id="playlistText" name="playlistText" rows={6} defaultValue={brief?.playlistText ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="technicalNeeds">Besoins techniques</Label>
              <Textarea id="technicalNeeds" name="technicalNeeds" rows={2} defaultValue={brief?.technicalNeeds ?? ""} placeholder="Micro HF pour les discours, retour scène…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="installationNotes">Installation</Label>
              <Textarea id="installationNotes" name="installationNotes" rows={2} defaultValue={brief?.installationNotes ?? ""} placeholder="Accès 16h, régie à droite de la piste, 2 × 16A…" />
            </div>
          </ActionForm>
        </ToolSection>
        <ToolSection
          title="Moments importants"
          description="Entrée des mariés, ouverture de bal, gâteau… avec le titre souhaité."
          action={
            <ActionDialog trigger={<Button size="sm">Ajouter</Button>} title="Moment important" action={addMomentAction.bind(null, eventId)} successMessage="Moment ajouté.">
              <div className="space-y-1.5">
                <Label htmlFor="km-title">Moment *</Label>
                <Input id="km-title" name="title" required placeholder="Ouverture de bal" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="km-song">Titre souhaité</Label>
                  <Input id="km-song" name="songTitle" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="km-artist">Artiste</Label>
                  <Input id="km-artist" name="artist" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="km-start">Heure prévue</Label>
                <Input id="km-start" name="startsAt" type="datetime-local" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="km-notes">Notes</Label>
                <Textarea id="km-notes" name="notes" rows={2} />
              </div>
            </ActionDialog>
          }
        >
          {moments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun moment défini.</p>
          ) : (
            <ol className="divide-y">
              {moments.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="flex items-start gap-3">
                    <div>
                      <div className="font-medium">{m.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {[m.songTitle, m.artist].filter(Boolean).join(" · ") || "Titre à définir"}
                        {m.startsAt ? ` · ${formatDateTime(m.startsAt, timezone)}` : ""}
                      </div>
                      {m.notes && <div className="text-sm text-muted-foreground">{m.notes}</div>}
                    </div>
                  </div>
                  <DeleteItemButton label={m.title} onConfirm={deleteMomentAction.bind(null, eventId, m.id)} />
                </li>
              ))}
            </ol>
          )}
        </ToolSection>
      </div>
    </div>
  );
}
