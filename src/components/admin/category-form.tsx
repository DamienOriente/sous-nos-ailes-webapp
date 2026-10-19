import { ActionForm, ActionSubmit, type FormAction } from "@/components/admin/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_GROUPS } from "@/modules/professionals/domain/categories";
import { FORM_SCHEMA_KEYS } from "@/modules/admin/application/catalog-admin";

export type CategoryFormValues = { id?: string; name: string; slug: string; group: string; icon: string; description: string | null; isChildcare: boolean; formSchemaKey: string; defaultTools: string[]; suggestedTemplates: string[]; sortOrder: number; isActive: boolean; usageCount?: number };

export function CategoryForm({ action, values, submitLabel }: { action: FormAction; values: CategoryFormValues; submitLabel: string }) {
  return (
    <ActionForm action={action} successMessage="Catégorie enregistrée." className="space-y-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom</Label>
          <Input id="name" name="name" required minLength={2} defaultValue={values.name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug (URL)</Label>
          <Input id="slug" name="slug" defaultValue={values.slug} placeholder="généré depuis le nom si vide" pattern="[a-z0-9-]*" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="group">Groupe</Label>
          <Input id="group" name="group" required list="groups" defaultValue={values.group} />
          <datalist id="groups">
            {CATEGORY_GROUPS.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="icon">Identifiant d'icône du catalogue (non affiché)</Label>
          <Input id="icon" name="icon" required defaultValue={values.icon} pattern="[a-z0-9-]+" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="formSchemaKey">Formulaire d'onboarding</Label>
          <select id="formSchemaKey" name="formSchemaKey" defaultValue={values.formSchemaKey} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            {FORM_SCHEMA_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder">Ordre d'affichage</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={values.sortOrder} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={values.description ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="defaultTools">Outils par défaut (clés, séparées par des virgules)</Label>
          <Textarea id="defaultTools" name="defaultTools" rows={2} defaultValue={values.defaultTools.join(", ")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="suggestedTemplates">Templates suggérés (clés)</Label>
          <Textarea id="suggestedTemplates" name="suggestedTemplates" rows={2} defaultValue={values.suggestedTemplates.join(", ")} />
        </div>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isChildcare" defaultChecked={values.isChildcare} /> Métier « enfants » (priorité annuaire, outils garde)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={values.isActive} /> Active
        </label>
      </div>
      {values.usageCount !== undefined && values.usageCount > 0 && <p className="text-xs text-muted-foreground">{values.usageCount} fiche(s) utilisent cette catégorie : la désactivation la masque sans la supprimer.</p>}
      <ActionSubmit>{submitLabel}</ActionSubmit>
    </ActionForm>
  );
}
