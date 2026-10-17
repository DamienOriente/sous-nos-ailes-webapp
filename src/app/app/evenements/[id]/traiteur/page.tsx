import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ActionDialog, ActionForm } from "@/components/childcare/action-form";
import { guardPage } from "@/components/childcare/page-guard";
import { DeleteItemButton, ToolSection } from "@/components/trade-tools/tool-blocks";
import { requireActor } from "@/lib/session";
import { formatEuros } from "@/lib/utils";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { formatDateTime, formatTime } from "@/modules/calendar/domain/datetime";
import { getCateringOverview, MENU_MOMENTS, MENU_MOMENT_LABELS } from "@/modules/trade-tools/application/catering-service";
import { addMenuAction, addStepAction, deleteMenuAction, deleteStepAction, savePlanAction } from "./actions";

export const metadata = { title: "Traiteur — Sous Nos Ailes" };

export default async function CateringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const actor = await requireActor(`/app/evenements/${eventId}/traiteur`);
  const { data, timezone } = await guardPage(async () => {
    const [data, timezone] = await Promise.all([getCateringOverview(actor, eventId), getUserTimezone(actor.userId)]);
    return { data, timezone };
  });
  const { headcount, plan, mealSplit, menus, steps, dietary } = data;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Outil métier"
        title="Traiteur"
        description="Convives, répartition des repas, menus, planning de service et décompte alimentaire anonyme. Les allergies individuelles restent du côté de l'équipe de garde."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={data.channelHref}>
              <MessageSquare className="size-4" aria-hidden="true" /> Coordination (messages)
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Adultes" value={headcount.totalAdults} hint={`${headcount.acceptedAdults} invités acceptés + ${headcount.manualAdults} manuels`} />
        <StatCard label="Enfants" value={headcount.totalChildren} hint={`${headcount.registeredChildren} enfants enregistrés`} />
        <StatCard label="Total couverts" value={headcount.totalAdults + headcount.totalChildren} />
        <StatCard label="Repas" value={`${mealSplit.cocktail} / ${mealSplit.dinner} / ${mealSplit.brunch}`} hint="cocktail / dîner / brunch" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ToolSection title="Convives et répartition" description="Ajustements manuels (équipe, prestataires, retardataires) et couverts par moment.">
          <ActionForm action={savePlanAction.bind(null, eventId)} successMessage="Plan enregistré." className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="manualAdults">Adultes en plus</Label>
              <Input id="manualAdults" name="manualAdults" type="number" min={0} defaultValue={plan?.manualAdults ?? 0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manualChildren">Enfants en plus</Label>
              <Input id="manualChildren" name="manualChildren" type="number" min={0} defaultValue={plan?.manualChildren ?? 0} />
            </div>
            <div aria-hidden="true" />
            <div className="space-y-1.5">
              <Label htmlFor="cocktail">Cocktail</Label>
              <Input id="cocktail" name="cocktail" type="number" min={0} defaultValue={mealSplit.cocktail} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dinner">Dîner</Label>
              <Input id="dinner" name="dinner" type="number" min={0} defaultValue={mealSplit.dinner} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brunch">Brunch</Label>
              <Input id="brunch" name="brunch" type="number" min={0} defaultValue={mealSplit.brunch} />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="deliveryNotes">Livraison</Label>
              <Textarea id="deliveryNotes" name="deliveryNotes" rows={2} defaultValue={plan?.deliveryNotes ?? ""} placeholder="Horaires, accès camion, quai…" />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="equipmentNotes">Matériel</Label>
              <Textarea id="equipmentNotes" name="equipmentNotes" rows={2} defaultValue={plan?.equipmentNotes ?? ""} placeholder="Office, froid, four, vaisselle fournie…" />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="constraints">Contraintes</Label>
              <Textarea id="constraints" name="constraints" rows={2} defaultValue={plan?.constraints ?? ""} />
            </div>
          </ActionForm>
        </ToolSection>

        <ToolSection title="Décompte alimentaire (anonyme)" description="Agrégats issus des invités acceptés et des enfants enregistrés : aucun nom, aucune donnée de santé.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Régime</TableHead>
                <TableHead className="text-right">Adultes</TableHead>
                <TableHead className="text-right">Enfants</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dietary.map((d) => (
                <TableRow key={d.label} data-testid="dietary-row">
                  <TableCell className="capitalize">{d.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.adults}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.children}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{d.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ToolSection>
      </div>

      <ToolSection
        title="Menus"
        action={
          <ActionDialog trigger={<Button size="sm"><Plus className="size-4" aria-hidden="true" /> Ajouter</Button>} title="Nouveau menu" action={addMenuAction.bind(null, eventId)} successMessage="Menu ajouté.">
            <div className="space-y-1.5">
              <Label htmlFor="m-moment">Moment</Label>
              <select id="m-moment" name="moment" defaultValue="dinner" className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                {MENU_MOMENTS.map((m) => (
                  <option key={m} value={m}>
                    {MENU_MOMENT_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Nom *</Label>
              <Input id="m-name" name="name" required maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-desc">Description</Label>
              <Textarea id="m-desc" name="description" rows={4} placeholder="Entrée, plat, dessert…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-price">Prix par couvert (€, indicatif)</Label>
              <Input id="m-price" name="pricePerCover" inputMode="decimal" placeholder="85" />
            </div>
          </ActionDialog>
        }
      >
        {menus.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun menu pour l'instant.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {menus.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 rounded-xl border p-4">
                <div>
                  <div className="text-xs font-semibold tracking-wider text-primary uppercase">{MENU_MOMENT_LABELS[m.moment as keyof typeof MENU_MOMENT_LABELS] ?? m.moment}</div>
                  <h3 className="font-medium">{m.name}</h3>
                  {m.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{m.description}</p>}
                  {m.pricePerCoverCents !== null && <p className="mt-1 text-sm">{formatEuros(m.pricePerCoverCents)} / couvert</p>}
                </div>
                <DeleteItemButton label={m.name} onConfirm={deleteMenuAction.bind(null, eventId, m.id)} />
              </li>
            ))}
          </ul>
        )}
      </ToolSection>

      <ToolSection
        title="Planning de service"
        action={
          <ActionDialog trigger={<Button size="sm"><Plus className="size-4" aria-hidden="true" /> Ajouter une étape</Button>} title="Étape de service" action={addStepAction.bind(null, eventId)} successMessage="Étape ajoutée.">
            <div className="space-y-1.5">
              <Label htmlFor="s-title">Étape *</Label>
              <Input id="s-title" name="title" required placeholder="Service du plat" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-start">Début *</Label>
                <Input id="s-start" name="startsAt" type="datetime-local" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-end">Fin</Label>
                <Input id="s-end" name="endsAt" type="datetime-local" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-notes">Notes</Label>
              <Textarea id="s-notes" name="notes" rows={2} />
            </div>
          </ActionDialog>
        }
      >
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune étape planifiée.</p>
        ) : (
          <ol className="divide-y">
            {steps.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(s.startsAt, timezone)}
                    {s.endsAt ? ` → ${formatTime(s.endsAt, timezone)}` : ""}
                  </div>
                  <div className="font-medium">{s.title}</div>
                  {s.notes && <div className="text-sm text-muted-foreground">{s.notes}</div>}
                </div>
                <DeleteItemButton label={s.title} onConfirm={deleteStepAction.bind(null, eventId, s.id)} />
              </li>
            ))}
          </ol>
        )}
      </ToolSection>
    </div>
  );
}
