import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionDialog } from "@/components/childcare/action-form";
import { guardPage } from "@/components/childcare/page-guard";
import { DeleteItemButton } from "@/components/trade-tools/tool-blocks";
import { requireActor } from "@/lib/session";
import { getEquipmentOverview, PROVIDED_BY, PROVIDED_BY_LABELS } from "@/modules/trade-tools/application/equipment-service";
import { addEquipmentAction, deleteEquipmentAction } from "./actions";

export const metadata = { title: "Matériel — Sous Nos Ailes" };

export default async function EquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const actor = await requireActor(`/app/evenements/${eventId}/materiel`);
  const data = await guardPage(() => getEquipmentOverview(actor, eventId));
  const { items, providers, tool } = data;
  const grouped = new Map<string, typeof items>();
  for (const i of items) {
    const key = i.memberName ? `${i.memberName}${i.memberCategory ? ` (${i.memberCategory})` : ""}` : "Organisation";
    grouped.set(key, [...(grouped.get(key) ?? []), i]);
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Outil métier"
        title="Matériel"
        description="Liste du matériel par prestataire : quantités, qui fournit, besoins électriques. Chaque prestataire gère ses lignes ; les organisateurs voient tout."
        actions={
          <ActionDialog trigger={<Button size="sm"><Plus className="size-4" aria-hidden="true" /> Ajouter du matériel</Button>} title="Nouvelle ligne de matériel" action={addEquipmentAction.bind(null, eventId)} successMessage="Matériel ajouté.">
            <div className="space-y-1.5">
              <Label htmlFor="eq-name">Désignation *</Label>
              <Input id="eq-name" name="name" required placeholder="Enceinte active 15 pouces" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="eq-qty">Quantité</Label>
                <Input id="eq-qty" name="quantity" type="number" min={1} defaultValue={1} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eq-by">Fourni par</Label>
                <select id="eq-by" name="providedBy" defaultValue="provider" className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                  {PROVIDED_BY.map((p) => (
                    <option key={p} value={p}>
                      {PROVIDED_BY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {tool.access.isOrganizer && providers.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="eq-member">Prestataire concerné</Label>
                <select id="eq-member" name="memberId" defaultValue="none" className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                  <option value="none">Organisation</option>
                  {providers.map((p) => (
                    <option key={p.memberId} value={p.memberId}>
                      {p.name}
                      {p.category ? ` (${p.category})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="eq-power">Besoins électriques</Label>
              <Input id="eq-power" name="powerNeeds" placeholder="2 × 16A, 3 kW" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-notes">Notes</Label>
              <Textarea id="eq-notes" name="notes" rows={2} />
            </div>
          </ActionDialog>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Package} title="Aucun matériel listé" description="Ajoutez le matériel apporté ou nécessaire pour que le lieu et les autres prestataires anticipent." />
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([group, rows]) => (
            <section key={group} className="overflow-x-auto rounded-2xl border bg-card">
              <h2 className="border-b px-4 py-2 text-sm font-semibold">{group}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead>Fourni par</TableHead>
                    <TableHead>Électricité</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="sr-only">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                      <TableCell>{PROVIDED_BY_LABELS[i.providedBy as keyof typeof PROVIDED_BY_LABELS] ?? i.providedBy}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{i.powerNeeds ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{i.notes ?? "—"}</TableCell>
                      <TableCell className="text-right">{(tool.access.isOrganizer || i.memberId === tool.access.memberId) && <DeleteItemButton label={i.name} onConfirm={deleteEquipmentAction.bind(null, eventId, i.id)} />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
