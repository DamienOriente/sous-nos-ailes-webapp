"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ActionForm, FieldErrorText, type FormAction } from "@/components/professionals/action-form";
import { formatEuros } from "@/lib/utils";
import type { ActionResult } from "@/lib/errors";
import { labelFor, PRICE_UNITS } from "@/modules/professionals/domain/listing-schema";
import type { ServiceRow } from "@/modules/professionals/application/services-service";

type Props = {
  professionalId: string;
  services: ServiceRow[];
  saveAction: FormAction;
  deleteAction: (professionalId: string, serviceId: string) => Promise<ActionResult<undefined>>;
  moveAction: (professionalId: string, serviceId: string, direction: "up" | "down") => Promise<ActionResult<undefined>>;
};

/** List of services with inline edit, plus a creation form. */
export function ServicesManager({ professionalId, services, saveAction, deleteAction, moveAction }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(services.length === 0);
  return (
    <div className="space-y-6">
      <ul className="space-y-3" data-testid="services-list">
        {services.map((s, i) => (
          <li key={s.id}>
            <Card className="gap-3 p-4">
              {editing === s.id ? (
                <ServiceFields professionalId={professionalId} service={s} action={saveAction} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      {s.name}
                      {!s.isActive && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Masquée</span>}
                    </p>
                    {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                    <p className="text-sm">
                      {s.priceCents !== null ? `${formatEuros(s.priceCents)} ${labelFor(PRICE_UNITS, s.priceUnit)}` : "Sur devis"}
                      {s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}
                      {s.minAge !== null || s.maxAge !== null ? ` · ${s.minAge ?? 0}–${s.maxAge ?? "+"} ans` : ""}
                      {s.capacity ? ` · jusqu'à ${s.capacity}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label="Monter" disabled={i === 0} onClick={() => moveAction(professionalId, s.id, "up").then((r) => !r.ok && toast.error(r.error))}>
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Descendre" disabled={i === services.length - 1} onClick={() => moveAction(professionalId, s.id, "down").then((r) => !r.ok && toast.error(r.error))}>
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(s.id)}>
                      <Pencil className="size-4" aria-hidden="true" />
                      Modifier
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button type="button" variant="ghost" size="icon" aria-label={`Supprimer ${s.name}`}>
                          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                        </Button>
                      }
                      title="Supprimer cette prestation ?"
                      description="Elle disparaît de votre fiche et de l'annuaire."
                      confirmLabel="Supprimer"
                      onConfirm={() => deleteAction(professionalId, s.id)}
                      successMessage="Prestation supprimée."
                    />
                  </div>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {creating ? (
        <Card className="p-4">
          <ServiceFields professionalId={professionalId} service={null} action={saveAction} onDone={() => setCreating(false)} />
        </Card>
      ) : (
        <Button type="button" onClick={() => setCreating(true)} data-testid="add-service">
          Ajouter une prestation
        </Button>
      )}
    </div>
  );
}

function ServiceFields({ professionalId, service, action, onDone }: { professionalId: string; service: ServiceRow | null; action: FormAction; onDone: () => void }) {
  const wrapped: FormAction = async (prev, form) => {
    const res = await action(prev, form);
    if (res?.ok) onDone();
    return res;
  };
  return (
    <ActionForm action={wrapped} submitLabel={service ? "Enregistrer" : "Ajouter"} successMessage={service ? "Prestation mise à jour." : "Prestation ajoutée."} footer={<Button type="button" variant="ghost" onClick={onDone}>Annuler</Button>}>
      <input type="hidden" name="professionalId" value={professionalId} />
      {service && <input type="hidden" name="serviceId" value={service.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`svc-name-${service?.id ?? "new"}`}>
            Nom de la prestation <span aria-hidden="true">*</span>
          </Label>
          <Input id={`svc-name-${service?.id ?? "new"}`} name="name" required minLength={2} maxLength={120} defaultValue={service?.name ?? ""} placeholder="Ex. Garde pendant la cérémonie et le cocktail" />
          <FieldErrorText name="name" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`svc-desc-${service?.id ?? "new"}`}>Description</Label>
          <Textarea id={`svc-desc-${service?.id ?? "new"}`} name="description" rows={3} maxLength={1000} defaultValue={service?.description ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`svc-price-${service?.id ?? "new"}`}>Prix (€, vide = sur devis)</Label>
          <Input id={`svc-price-${service?.id ?? "new"}`} name="priceEuros" inputMode="decimal" defaultValue={service?.priceCents != null ? (service.priceCents / 100).toString() : ""} />
          <FieldErrorText name="priceCents" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`svc-unit-${service?.id ?? "new"}`}>Unité</Label>
          <select id={`svc-unit-${service?.id ?? "new"}`} name="priceUnit" defaultValue={service?.priceUnit ?? ""} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
            <option value="">—</option>
            {PRICE_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`svc-dur-${service?.id ?? "new"}`}>Durée (minutes)</Label>
          <Input id={`svc-dur-${service?.id ?? "new"}`} name="durationMinutes" type="number" min={0} defaultValue={service?.durationMinutes ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`svc-cap-${service?.id ?? "new"}`}>Capacité (personnes / enfants)</Label>
          <Input id={`svc-cap-${service?.id ?? "new"}`} name="capacity" type="number" min={0} defaultValue={service?.capacity ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`svc-min-${service?.id ?? "new"}`}>Âge minimal</Label>
          <Input id={`svc-min-${service?.id ?? "new"}`} name="minAge" type="number" min={0} max={18} defaultValue={service?.minAge ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`svc-max-${service?.id ?? "new"}`}>Âge maximal</Label>
          <Input id={`svc-max-${service?.id ?? "new"}`} name="maxAge" type="number" min={0} max={18} defaultValue={service?.maxAge ?? ""} />
          <FieldErrorText name="maxAge" />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Checkbox id={`svc-active-${service?.id ?? "new"}`} name="isActive" defaultChecked={service?.isActive ?? true} />
          <Label htmlFor={`svc-active-${service?.id ?? "new"}`} className="font-normal">
            Visible sur ma fiche
          </Label>
        </div>
      </div>
    </ActionForm>
  );
}
