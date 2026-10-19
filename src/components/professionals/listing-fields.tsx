import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldErrorText } from "@/components/professionals/action-form";
import { EVENT_TYPE_OPTIONS, LANGUAGE_OPTIONS, ORGANIZATION_TYPES, PRICE_UNITS } from "@/modules/professionals/domain/listing-schema";
import type { ProfessionalRow } from "@/modules/professionals/application/professional-service";

/** Step 2 — commercial identity and location. */
export function IdentityFields({ listing, organizationType, siret }: { listing: Partial<ProfessionalRow> | null; organizationType?: string | null; siret?: string | null }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="displayName">
          Nom commercial <span aria-hidden="true">*</span>
        </Label>
        <Input id="displayName" name="displayName" required minLength={2} maxLength={80} defaultValue={listing?.displayName ?? ""} autoComplete="organization" />
        <p className="text-xs text-muted-foreground">C'est le nom affiché dans l'annuaire. Il sert aussi à construire l'adresse de votre page.</p>
        <FieldErrorText name="displayName" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="organizationType">
          Statut / type de structure <span aria-hidden="true">*</span>
        </Label>
        <select id="organizationType" name="organizationType" required defaultValue={organizationType ?? "sole_trader"} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
          {ORGANIZATION_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <FieldErrorText name="organizationType" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="siret">SIREN ou SIRET (facultatif)</Label>
        <Input id="siret" name="siret" inputMode="numeric" placeholder="123 456 789 00012" defaultValue={siret ?? ""} />
        <p className="text-xs text-muted-foreground">Vérifié syntaxiquement maintenant, contrôlé sur pièce par notre équipe ensuite.</p>
        <FieldErrorText name="siret" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">
          Ville <span aria-hidden="true">*</span>
        </Label>
        <Input id="city" name="city" required defaultValue={listing?.city ?? ""} autoComplete="address-level2" />
        <FieldErrorText name="city" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="postalCode">
          Code postal <span aria-hidden="true">*</span>
        </Label>
        <Input id="postalCode" name="postalCode" required inputMode="numeric" pattern="\d{5}" maxLength={5} defaultValue={listing?.postalCode ?? ""} autoComplete="postal-code" />
        <p className="text-xs text-muted-foreground">Le département et la région sont déduits automatiquement.</p>
        <FieldErrorText name="postalCode" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="interventionRadiusKm">Rayon d'intervention</Label>
        <div className="flex items-center gap-2">
          <Input id="interventionRadiusKm" name="interventionRadiusKm" type="number" min={0} max={500} step={5} defaultValue={listing?.interventionRadiusKm ?? 50} className="max-w-32" />
          <span className="text-sm text-muted-foreground">km autour de votre ville</span>
        </div>
        <FieldErrorText name="interventionRadiusKm" />
      </div>
    </div>
  );
}

/** Step 4 — presentation, pricing, languages, event types, contacts. */
export function PresentationFields({ listing }: { listing: Partial<ProfessionalRow> | null }) {
  const langs = listing?.languages ?? ["fr"];
  const types = listing?.eventTypes ?? [];
  const social = listing?.socialLinks ?? {};
  return (
    <div className="space-y-8">
      <div className="grid gap-5">
        <div className="space-y-2">
          <Label htmlFor="tagline">Accroche (140 caractères max)</Label>
          <Input id="tagline" name="tagline" maxLength={140} defaultValue={listing?.tagline ?? ""} placeholder="Ex. Garde d'enfants douce et créative pour vos mariages en Occitanie" />
          <FieldErrorText name="tagline" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={7} maxLength={4000} defaultValue={listing?.description ?? ""} placeholder="Présentez votre approche, votre expérience, ce qui vous distingue. Les organisateurs lisent cette description avant de vous contacter." />
          <p className="text-xs text-muted-foreground">Au moins 200 caractères recommandés. Pas de coordonnées ici : elles ont leur champ dédié.</p>
          <FieldErrorText name="description" />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Tarifs indicatifs</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="priceFromEuros">À partir de (€)</Label>
            <Input id="priceFromEuros" name="priceFromEuros" inputMode="decimal" defaultValue={listing?.priceFromCents != null ? (listing.priceFromCents / 100).toString() : ""} />
            <FieldErrorText name="priceFromCents" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priceToEuros">Jusqu'à (€)</Label>
            <Input id="priceToEuros" name="priceToEuros" inputMode="decimal" defaultValue={listing?.priceToCents != null ? (listing.priceToCents / 100).toString() : ""} />
            <FieldErrorText name="priceToCents" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priceUnit">Unité</Label>
            <select id="priceUnit" name="priceUnit" defaultValue={listing?.priceUnit ?? ""} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">Non précisée</option>
              {PRICE_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Indicatif et TTC. Les devis restent personnalisés.</p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Types d'évènements couverts</legend>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPE_OPTIONS.map((o) => (
            <label key={o.value} className="cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary">
              <input type="checkbox" name="eventTypes" value={o.value} defaultChecked={types.includes(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Langues parlées <span aria-hidden="true">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((o) => (
            <label key={o.value} className="cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary">
              <input type="checkbox" name="languages" value={o.value} defaultChecked={langs.includes(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
        <FieldErrorText name="languages" />
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="yearsExperience">Années d'expérience</Label>
          <Input id="yearsExperience" name="yearsExperience" type="number" min={0} max={70} defaultValue={listing?.yearsExperience ?? ""} className="max-w-32" />
          <FieldErrorText name="yearsExperience" />
        </div>
        <div className="flex items-start gap-3 pt-6">
          <Checkbox id="acceptsChildrenServices" name="acceptsChildrenServices" defaultChecked={listing?.acceptsChildrenServices ?? false} />
          <Label htmlFor="acceptsChildrenServices" className="font-normal">
            Mes prestations incluent ou acceptent la présence d'enfants
          </Label>
        </div>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Contacts professionnels affichés publiquement</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="publicEmail">E-mail pro</Label>
            <Input id="publicEmail" name="publicEmail" type="email" defaultValue={listing?.publicEmail ?? ""} autoComplete="email" />
            <FieldErrorText name="publicEmail" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publicPhone">Téléphone pro</Label>
            <Input id="publicPhone" name="publicPhone" type="tel" defaultValue={listing?.publicPhone ?? ""} autoComplete="tel" />
            <FieldErrorText name="publicPhone" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Site web</Label>
            <Input id="website" name="website" type="text" inputMode="url" placeholder="https://" defaultValue={listing?.website ?? ""} />
            <FieldErrorText name="website" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" name="instagram" placeholder="@votrecompte" defaultValue={social.instagram ?? ""} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="facebook">Page Facebook</Label>
            <Input id="facebook" name="facebook" placeholder="https://facebook.com/…" defaultValue={social.facebook ?? ""} />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
