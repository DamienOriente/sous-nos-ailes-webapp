import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RosterChild } from "@/modules/childcare/application/children-service";
import { toLocalInputValue } from "@/modules/calendar/domain/datetime";

type Initial = Partial<Pick<RosterChild, "firstName" | "lastName" | "ageYears" | "guardianName" | "guardianPhone" | "dietaryPreference" | "careInstructions" | "expectedArrivalAt" | "expectedDepartureAt">> & { guardianEmail?: string | null };

/** Fields of the child form (create + edit). Names match childInputSchema. No health field here: it has its own consent flow. */
export function ChildFormFields({ initial, timezone, fieldErrors = {} }: { initial?: Initial; timezone: string; fieldErrors?: Record<string, string[]> }) {
  const err = (k: string) => fieldErrors[k]?.[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="firstName">Prénom *</Label>
        <Input id="firstName" name="firstName" required maxLength={80} defaultValue={initial?.firstName ?? ""} aria-invalid={Boolean(err("firstName"))} />
        {err("firstName") && <p className="text-xs text-destructive">{err("firstName")}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lastName">Nom</Label>
        <Input id="lastName" name="lastName" maxLength={80} defaultValue={initial?.lastName ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ageYears">Âge (années) *</Label>
        <Input id="ageYears" name="ageYears" type="number" inputMode="numeric" min={0} max={17} required defaultValue={initial?.ageYears ?? ""} />
        <p className="text-xs text-muted-foreground">La date de naissance n'est pas collectée.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dietaryPreference">Régime alimentaire</Label>
        <Input id="dietaryPreference" name="dietaryPreference" placeholder="végétarien, sans porc…" maxLength={80} defaultValue={initial?.dietaryPreference ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="guardianName">Responsable légal présent *</Label>
        <Input id="guardianName" name="guardianName" required maxLength={120} defaultValue={initial?.guardianName ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="guardianPhone">Téléphone du responsable *</Label>
        <Input id="guardianPhone" name="guardianPhone" type="tel" required maxLength={30} defaultValue={initial?.guardianPhone ?? ""} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="guardianEmail">E-mail du responsable (optionnel)</Label>
        <Input id="guardianEmail" name="guardianEmail" type="email" defaultValue={initial?.guardianEmail ?? ""} aria-invalid={Boolean(err("guardianEmail"))} />
        {err("guardianEmail") && <p className="text-xs text-destructive">{err("guardianEmail")}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expectedArrivalAt">Arrivée prévue</Label>
        <Input id="expectedArrivalAt" name="expectedArrivalAt" type="datetime-local" defaultValue={toLocalInputValue(initial?.expectedArrivalAt, timezone)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expectedDepartureAt">Départ prévu</Label>
        <Input id="expectedDepartureAt" name="expectedDepartureAt" type="datetime-local" defaultValue={toLocalInputValue(initial?.expectedDepartureAt, timezone)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="careInstructions">Consignes opérationnelles (non médicales)</Label>
        <Textarea id="careInstructions" name="careInstructions" rows={3} maxLength={2000} placeholder="Sieste après le déjeuner, doudou dans le sac…" defaultValue={initial?.careInstructions ?? ""} />
        <p className="text-xs text-muted-foreground">Les allergies et notes de santé se saisissent séparément, avec le consentement du responsable légal.</p>
      </div>
    </div>
  );
}
