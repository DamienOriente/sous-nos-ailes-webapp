import Link from "next/link";
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
import { formatDateTime, formatTime } from "@/modules/calendar/domain/datetime";
import { privateFileHref } from "@/modules/files/application/file-urls";
import { getVenueOverview, SPACE_USAGE_LABELS, SPACE_USAGES } from "@/modules/trade-tools/application/venue-service";
import { addAllocationAction, addSpaceAction, deleteAllocationAction, deleteSpaceAction, saveLogisticsAction } from "./actions";

export const metadata = { title: "Lieu" };

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const actor = await requireActor(`/app/evenements/${eventId}/lieu`);
  const { data, timezone } = await guardPage(async () => {
    const [data, timezone] = await Promise.all([getVenueOverview(actor, eventId), getUserTimezone(actor.userId)]);
    return { data, timezone };
  });
  const { spaces, allocations, logistics, milestones, providers, documents } = data;
  return (
    <div className="space-y-6">
      <PageHeader title="Lieu" description="Espaces, affectation des moments, contraintes techniques, planning d'installation et intervenants attendus." />
      <div className="grid gap-6 lg:grid-cols-2">
        <ToolSection
          title="Espaces du lieu"
          action={
            <ActionDialog trigger={<Button size="sm">Ajouter</Button>} title="Nouvel espace" action={addSpaceAction.bind(null, eventId)} successMessage="Espace ajouté.">
              <div className="space-y-1.5">
                <Label htmlFor="sp-name">Nom *</Label>
                <Input id="sp-name" name="name" required placeholder="Orangerie" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sp-cap">Capacité</Label>
                  <Input id="sp-cap" name="capacity" type="number" min={0} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sp-usage">Usage</Label>
                  <select id="sp-usage" name="usage" defaultValue="other" className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                    {SPACE_USAGES.map((u) => (
                      <option key={u} value={u}>
                        {SPACE_USAGE_LABELS[u]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-notes">Notes</Label>
                <Textarea id="sp-notes" name="notes" rows={2} />
              </div>
            </ActionDialog>
          }
        >
          {spaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun espace décrit.</p>
          ) : (
            <ul className="divide-y">
              {spaces.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium">
                      {s.name} <span className="text-xs text-muted-foreground">· {SPACE_USAGE_LABELS[s.usage as keyof typeof SPACE_USAGE_LABELS] ?? s.usage}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {s.capacity ? `${s.capacity} personnes` : "Capacité non précisée"}
                      {s.notes ? ` · ${s.notes}` : ""}
                    </div>
                  </div>
                  <DeleteItemButton label={s.name} onConfirm={deleteSpaceAction.bind(null, eventId, s.id)} />
                </li>
              ))}
            </ul>
          )}
        </ToolSection>

        <ToolSection
          title="Espaces ↔ moments"
          description="Quel espace accueille quel moment du planning."
          action={
            spaces.length > 0 && (
              <ActionDialog trigger={<Button size="sm">Affecter</Button>} title="Affecter un espace à un moment" action={addAllocationAction.bind(null, eventId)} successMessage="Affectation ajoutée.">
                <div className="space-y-1.5">
                  <Label htmlFor="al-space">Espace *</Label>
                  <select id="al-space" name="spaceId" required className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                    {spaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="al-label">Moment *</Label>
                  <Input id="al-label" name="label" required placeholder="Vin d'honneur" />
                </div>
                {milestones.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="al-ms">Lier à une étape du planning</Label>
                    <select id="al-ms" name="milestoneId" defaultValue="none" className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                      <option value="none">Aucune</option>
                      {milestones.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="al-start">Début *</Label>
                    <Input id="al-start" name="startsAt" type="datetime-local" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="al-end">Fin</Label>
                    <Input id="al-end" name="endsAt" type="datetime-local" />
                  </div>
                </div>
              </ActionDialog>
            )
          }
        >
          {allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune affectation.</p>
          ) : (
            <ol className="divide-y">
              {allocations.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(a.startsAt, timezone)}
                      {a.endsAt ? ` à ${formatTime(a.endsAt, timezone)}` : ""}
                    </div>
                    <div className="font-medium">
                      {a.label} <span className="text-muted-foreground">({a.spaceName})</span>
                    </div>
                  </div>
                  <DeleteItemButton label={a.label} onConfirm={deleteAllocationAction.bind(null, eventId, a.id)} />
                </li>
              ))}
            </ol>
          )}
        </ToolSection>
      </div>

      <ToolSection title="Contraintes techniques et installation">
        <ActionForm action={saveLogisticsAction.bind(null, eventId)} successMessage="Fiche logistique enregistrée." className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="electricalNotes">Électricité</Label>
            <Textarea id="electricalNotes" name="electricalNotes" rows={3} defaultValue={logistics?.electricalNotes ?? ""} placeholder="Puissance disponible, prises, groupe électrogène…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accessNotes">Accès et livraisons</Label>
            <Textarea id="accessNotes" name="accessNotes" rows={3} defaultValue={logistics?.accessNotes ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="noiseNotes">Bruit / horaires</Label>
            <Textarea id="noiseNotes" name="noiseNotes" rows={3} defaultValue={logistics?.noiseNotes ?? ""} placeholder="Musique extérieure jusqu'à 23h, intérieur jusqu'à 4h…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="otherConstraints">Autres contraintes</Label>
            <Textarea id="otherConstraints" name="otherConstraints" rows={3} defaultValue={logistics?.otherConstraints ?? ""} />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="installationPlan">Planning d'installation</Label>
            <Textarea id="installationPlan" name="installationPlan" rows={5} defaultValue={logistics?.installationPlan ?? ""} placeholder={"Vendredi 14h : livraison mobilier\nSamedi 9h : décoration, 11h : traiteur…"} />
          </div>
        </ActionForm>
      </ToolSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <ToolSection title="Intervenants attendus" description="Prestataires confirmés ou en devis, avec leurs créneaux.">
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun prestataire confirmé pour l'instant.</p>
          ) : (
            <ul className="divide-y text-sm">
              {providers.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium">{p.name ?? p.externalName ?? "Prestataire"}</div>
                    <div className="text-muted-foreground">{p.category ?? "Non renseignée"}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {p.serviceStartsAt ? formatDateTime(p.serviceStartsAt, timezone) : "Créneau à préciser"}
                    {p.serviceEndsAt ? ` à ${formatTime(p.serviceEndsAt, timezone)}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ToolSection>
        <ToolSection title="Documents techniques" description="Plans et fiches techniques partagés dans les documents de l'évènement.">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun plan déposé.{" "}
              <Link href={`/app/evenements/${eventId}/documents`} className="underline">
                Documents de l'évènement
              </Link>
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {documents.map((d) => (
                <li key={d.id}>
                  <a href={privateFileHref(d.fileId)} className="inline-flex items-center gap-2 hover:underline">
                     {d.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </ToolSection>
      </div>
    </div>
  );
}
