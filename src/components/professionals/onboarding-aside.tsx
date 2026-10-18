import Link from "next/link";
import { ListingPreviewCard, type ListingPreviewData } from "@/components/professionals/listing-preview-card";
import { listingExample } from "@/components/professionals/listing-examples";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Side column of the professional onboarding: the listing drawing itself,
 * the advice for the current step and the worked example of the trade.
 * "Utiliser cet exemple" reloads the step with `?exemple=1`: the server then
 * renders the example as default values, which the professional can edit.
 */
export function ProfessionalOnboardingAside({
  step,
  listing,
  category,
  exampleActive,
  exampleHref,
  className,
}: {
  step: number;
  listing: Partial<ListingPreviewData>;
  category: { slug: string; name: string; icon: string; formSchemaKey: string } | null;
  exampleActive: boolean;
  exampleHref: string | null;
  className?: string;
}) {
  const example = listingExample(category?.formSchemaKey ?? "generic");
  const tip = step === 2 ? example.tips.identity : step === 3 ? example.tips.trade : step === 4 ? example.tips.presentation : step === 1 ? "Choisissez le métier qui décrit le mieux ce que vous vendez. Il détermine le formulaire de l'étape 3, les outils proposés et la catégorie de l'annuaire où vous apparaissez." : "Relisez comme un organisateur pressé : nom, ville, tarif, puis l'accroche. Le modèle de page se change plus tard sans perdre vos textes.";
  const exampleLines = step === 2 ? [example.displayName, `${example.city} (${example.postalCode}) · ${example.interventionRadiusKm} km`] : step === 4 ? [example.tagline, `${example.priceFromEuros} à ${example.priceToEuros} € ${priceUnitLabel(example.priceUnit)} · ${example.yearsExperience} ans d'expérience`] : step === 3 ? Object.entries(example.tradeDetails).slice(0, 3).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(", ") : String(v)}`) : [];
  return (
    <aside className={cn("space-y-5", className)} aria-label="Aperçu et conseils">
      <div className="space-y-2">
        <p className="text-sm font-medium">Votre fiche se dessine</p>
        <ListingPreviewCard listing={listing} category={category} step={step} />
      </div>
      <p className="rounded-2xl border bg-accent/40 p-4 text-sm text-pretty">{tip}</p>
      {step >= 2 && step <= 4 && exampleHref && (
        <div className="space-y-3 rounded-2xl border border-dashed p-4 text-sm" data-testid="onboarding-example">
          <p className="font-medium">Exemple pour un·e {category?.name.toLowerCase() ?? "professionnel"}</p>
          <ul className="space-y-1 text-muted-foreground">
            {exampleLines.map((l) => (
              <li key={l} className="truncate">
                {l}
              </li>
            ))}
          </ul>
          {exampleActive ? (
            <p className="text-xs text-muted-foreground">L'exemple est pré-rempli dans le formulaire : modifiez ce qui ne vous correspond pas avant de continuer.</p>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={exampleHref} scroll={false}>
                Utiliser cet exemple
              </Link>
            </Button>
          )}
        </div>
      )}
    </aside>
  );
}

function priceUnitLabel(unit: string): string {
  return { hour: "de l'heure", half_day: "la demi-journée", day: "la journée", event: "par évènement", guest: "par invité", child: "par enfant" }[unit] ?? "";
}
