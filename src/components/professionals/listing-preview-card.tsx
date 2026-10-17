import { MapPin, ShieldCheck } from "lucide-react";
import { CategoryIcon } from "@/components/professionals/category-icons";
import { DemoPhoto } from "@/components/shared/demo-photo";
import { cn, formatEuros } from "@/lib/utils";
import { categoryPhoto } from "@/modules/media/demo-photos";
import { EVENT_TYPE_OPTIONS, LANGUAGE_OPTIONS, PRICE_UNITS, labelFor } from "@/modules/professionals/domain/listing-schema";

export type ListingPreviewData = {
  displayName: string;
  tagline: string | null;
  city: string | null;
  interventionRadiusKm: number | null;
  priceFromCents: number | null;
  priceToCents: number | null;
  priceUnit: string | null;
  languages: string[];
  eventTypes: string[];
  yearsExperience: number | null;
  acceptsChildrenServices: boolean;
  completenessScore?: number | null;
};

/**
 * Directory-style card that draws itself as the onboarding progresses:
 * unknown fields are shown as soft placeholders, so the professional sees
 * what each step adds. The photo comes from the demo catalogue (labelled) —
 * the real gallery is uploaded after publication.
 */
export function ListingPreviewCard({ listing, category, step, className }: { listing: Partial<ListingPreviewData>; category: { slug: string; name: string; icon: string } | null; step: number; className?: string }) {
  const photo = categoryPhoto(category?.slug ?? "reception", 0);
  const name = listing.displayName?.trim();
  const price = listing.priceFromCents != null ? `${formatEuros(listing.priceFromCents)}${listing.priceToCents != null ? ` – ${formatEuros(listing.priceToCents)}` : ""}${listing.priceUnit ? ` ${labelFor(PRICE_UNITS, listing.priceUnit)}` : ""}` : null;
  const languages = (listing.languages ?? []).map((l) => labelFor(LANGUAGE_OPTIONS, l)).filter(Boolean);
  const types = (listing.eventTypes ?? []).map((t) => labelFor(EVENT_TYPE_OPTIONS, t)).filter(Boolean);
  return (
    <article className={cn("overflow-hidden rounded-2xl border bg-card shadow-soft", className)} aria-label="Aperçu de votre fiche dans l'annuaire" data-testid="listing-preview">
      <div className="relative aspect-[16/9]">
        <DemoPhoto photo={photo} width={640} height={360} sizes="(max-width: 1024px) 100vw, 360px" className="absolute inset-0" alt={`Photo d'ambiance de démonstration pour le métier ${category?.name ?? "sélectionné"}`} />
        <span className="absolute bottom-2 left-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] text-muted-foreground">Photo d'ambiance de démonstration</span>
        {category && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-primary shadow-soft">
            <CategoryIcon icon={category.icon} className="size-3.5" />
            {category.name}
          </span>
        )}
      </div>
      <div className="space-y-3 p-4">
        {name ? <h3 className="font-heading text-lg leading-snug font-semibold">{name}</h3> : <Placeholder className="h-5 w-3/4" hint={step <= 2 ? "Nom commercial (étape 2)" : undefined} />}
        {listing.tagline ? <p className="text-sm text-muted-foreground text-pretty">{listing.tagline}</p> : <Placeholder className="h-4 w-full" hint={step <= 4 ? "Accroche (étape 4)" : undefined} />}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {listing.city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {listing.city}
              {listing.interventionRadiusKm ? ` · ${listing.interventionRadiusKm} km` : ""}
            </span>
          ) : (
            <Placeholder className="h-3.5 w-24" />
          )}
          {listing.yearsExperience != null && listing.yearsExperience > 0 && <span>{listing.yearsExperience} ans d'expérience</span>}
          {listing.acceptsChildrenServices && (
            <span className="inline-flex items-center gap-1 text-primary">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Accueille les enfants
            </span>
          )}
        </div>
        {(types.length > 0 || languages.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => (
              <span key={t} className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">
                {t}
              </span>
            ))}
            {languages.map((l) => (
              <span key={l} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {l}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          {price ? <span className="font-medium">{price}</span> : <Placeholder className="h-4 w-28" hint={step <= 4 ? "Tarifs (étape 4)" : undefined} />}
          {listing.completenessScore != null && <span className="text-xs text-muted-foreground tabular-nums">Complétude {listing.completenessScore} %</span>}
        </div>
      </div>
    </article>
  );
}

function Placeholder({ className, hint }: { className: string; hint?: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("block rounded-md bg-muted", className)} aria-hidden="true" />
      {hint && <span className="shrink-0 text-[10px] text-muted-foreground">{hint}</span>}
    </span>
  );
}
