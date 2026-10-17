import { ActionForm, ActionSubmit, type FormAction } from "@/components/admin/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FEATURES } from "@/modules/billing/domain/plans";

export type ToolFormValues = { key: string; name: string; description: string; audience: string; requiredFeature: string | null; categorySlugs: string[]; isActive: boolean; sortOrder: number };

export function ToolForm({ action, values, isNew, submitLabel }: { action: FormAction; values: ToolFormValues; isNew: boolean; submitLabel: string }) {
  return (
    <ActionForm action={action} successMessage="Outil enregistré." className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="key">Clé</Label>
          <Input id="key" name="key" required defaultValue={values.key} readOnly={!isNew} pattern="[a-z][a-z0-9_]+" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom</Label>
          <Input id="name" name="name" required minLength={2} defaultValue={values.name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audience">Audience</Label>
          <select id="audience" name="audience" defaultValue={values.audience} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            <option value="both">Organisateurs et professionnels</option>
            <option value="organizer">Organisateurs</option>
            <option value="professional">Professionnels</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="requiredFeature">Fonctionnalité requise (offre)</Label>
          <select id="requiredFeature" name="requiredFeature" defaultValue={values.requiredFeature ?? ""} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            <option value="">Aucune (gratuit)</option>
            {Object.entries(FEATURES).map(([k, label]) => (
              <option key={k} value={k}>
                {label} ({k})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder">Ordre</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={values.sortOrder} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={values.description} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="categorySlugs">Métiers concernés (slugs, vide = tous)</Label>
        <Textarea id="categorySlugs" name="categorySlugs" rows={2} defaultValue={values.categorySlugs.join(", ")} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={values.isActive} /> Actif
      </label>
      <ActionSubmit>{submitLabel}</ActionSubmit>
    </ActionForm>
  );
}
