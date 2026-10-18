import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton, ActionDialog, ActionForm } from "@/components/childcare/action-form";
import { guardPage } from "@/components/childcare/page-guard";
import { DeleteItemButton, ToolSection } from "@/components/trade-tools/tool-blocks";
import { requireActor } from "@/lib/session";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { formatDateTime } from "@/modules/calendar/domain/datetime";
import { getImagesOverview } from "@/modules/trade-tools/application/images-service";
import { addShotAction, deleteShotAction, saveImageBriefAction, toggleConsentAction } from "./actions";

export const metadata = { title: "Photo / vidéo" };

export default async function ImagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const actor = await requireActor(`/app/evenements/${eventId}/images`);
  const { data, timezone } = await guardPage(async () => {
    const [data, timezone] = await Promise.all([getImagesOverview(actor, eventId), getUserTimezone(actor.userId)]);
    return { data, timezone };
  });
  const { brief, moments, locations } = data;
  return (
    <div className="space-y-6">
      <PageHeader title="Photo et vidéo" description="Brief, moments à ne pas manquer, lieux de prise de vue, coordonnées utiles et suivi des autorisations de diffusion. Aucune donnée tierce au-delà de ce que l'organisateur saisit." />
      <div className="grid gap-6 lg:grid-cols-2">
        <ToolSection title="Brief">
          <ActionForm action={saveImageBriefAction.bind(null, eventId)} successMessage="Brief enregistré.">
            <div className="space-y-1.5">
              <Label htmlFor="brief">Attentes, style, livrables</Label>
              <Textarea id="brief" name="brief" rows={6} defaultValue={brief?.brief ?? ""} placeholder="Reportage naturel, peu de poses, lumière du soir pour les photos de couple…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usefulContacts">Coordonnées utiles le jour J</Label>
              <Textarea id="usefulContacts" name="usefulContacts" rows={3} defaultValue={brief?.usefulContacts ?? ""} placeholder="Témoin référent : Prénom, 06…" />
            </div>
          </ActionForm>
        </ToolSection>
        <div className="space-y-6">
          <ToolSection title="Moments à capturer" action={<ShotDialog kind="moment" eventId={eventId} />}>
            {moments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun moment listé.</p>
            ) : (
              <ul className="divide-y">
                {moments.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="flex items-start gap-3">
                      <div>
                        <div className="font-medium">{m.title}</div>
                        <div className="text-sm text-muted-foreground">{[m.startsAt ? formatDateTime(m.startsAt, timezone) : null, m.location, m.notes].filter(Boolean).join(" · ")}</div>
                        <ActionButton action={toggleConsentAction.bind(null, eventId, m.id, !m.releaseConsentCollected)} variant="outline" size="xs">
                          {m.releaseConsentCollected ? "Autorisation de diffusion recueillie" : "Autorisation de diffusion : à recueillir"}
                        </ActionButton>
                      </div>
                    </div>
                    <DeleteItemButton label={m.title} onConfirm={deleteShotAction.bind(null, eventId, m.id)} />
                  </li>
                ))}
              </ul>
            )}
          </ToolSection>
          <ToolSection title="Lieux de prise de vue" action={<ShotDialog kind="location" eventId={eventId} />}>
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun lieu repéré.</p>
            ) : (
              <ul className="divide-y">
                {locations.map((l) => (
                  <li key={l.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="flex items-start gap-3">
                      <div>
                        <div className="font-medium">{l.title}</div>
                        {l.notes && <div className="text-sm text-muted-foreground">{l.notes}</div>}
                      </div>
                    </div>
                    <DeleteItemButton label={l.title} onConfirm={deleteShotAction.bind(null, eventId, l.id)} />
                  </li>
                ))}
              </ul>
            )}
          </ToolSection>
        </div>
      </div>
    </div>
  );
}

function ShotDialog({ kind, eventId }: { kind: "moment" | "location"; eventId: string }) {
  return (
    <ActionDialog trigger={<Button size="sm">Ajouter</Button>} title={kind === "moment" ? "Moment à capturer" : "Lieu de prise de vue"} action={addShotAction.bind(null, eventId)} successMessage="Ajouté.">
      <input type="hidden" name="kind" value={kind} />
      <div className="space-y-1.5">
        <Label htmlFor={`sh-title-${kind}`}>{kind === "moment" ? "Moment *" : "Lieu *"}</Label>
        <Input id={`sh-title-${kind}`} name="title" required placeholder={kind === "moment" ? "Échange des alliances" : "Allée de platanes"} />
      </div>
      {kind === "moment" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sh-start">Heure prévue</Label>
            <Input id="sh-start" name="startsAt" type="datetime-local" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh-loc">Lieu</Label>
            <Input id="sh-loc" name="location" />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`sh-notes-${kind}`}>Notes</Label>
        <Textarea id={`sh-notes-${kind}`} name="notes" rows={2} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox name="releaseConsentCollected" className="mt-0.5" /> Autorisation de diffusion recueillie pour les personnes / le groupe concerné
      </label>
    </ActionDialog>
  );
}
