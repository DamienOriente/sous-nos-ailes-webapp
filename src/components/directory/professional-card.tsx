import Link from "next/link";
import { Baby, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DemoPhoto } from "@/components/shared/demo-photo";
import { formatEuros } from "@/lib/utils";
import { publicImageHref } from "@/modules/files/application/file-urls";
import { categoryPhoto } from "@/modules/media/demo-photos";
import { labelFor, PRICE_UNITS } from "@/modules/professionals/domain/listing-schema";
import type { DirectoryCard } from "@/modules/directory/application/directory-search";
import { FavoriteButton } from "./favorite-button";
import { VerificationBadge } from "./verification-badge";

export type ProfessionalCardProps = {
  professional: DirectoryCard;
  signedIn?: boolean;
  sponsored?: boolean;
  /** Hide the heart (e.g. inside the professional's own preview). */
  hideFavorite?: boolean;
};

export function priceLabel(p: { priceFromCents: number | null; priceToCents: number | null; priceUnit: string | null }): string | null {
  if (p.priceFromCents === null && p.priceToCents === null) return null;
  const unit = labelFor(PRICE_UNITS, p.priceUnit);
  if (p.priceFromCents !== null && p.priceToCents !== null && p.priceToCents !== p.priceFromCents) return `${formatEuros(p.priceFromCents)} – ${formatEuros(p.priceToCents)}${unit ? ` ${unit}` : ""}`;
  const v = p.priceFromCents ?? p.priceToCents ?? 0;
  return `À partir de ${formatEuros(v)}${unit ? ` ${unit}` : ""}`;
}

/** Stable 0..n index from a slug so a listing without cover always gets the same illustration. */
function slugIndex(slug: string): number {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 1_000_003;
  return h;
}

/** Directory result card. Also used on category pages, the home page and in the organiser's favourites. */
export function ProfessionalCard({ professional: p, signedIn = false, sponsored = false, hideFavorite = false }: ProfessionalCardProps) {
  const href = `/pro/${p.slug}`;
  const price = priceLabel(p);
  const fallback = p.coverFileId ? null : categoryPhoto(p.categorySlug, slugIndex(p.slug));
  return (
    <Card className="group relative flex h-full flex-col gap-0 overflow-hidden p-0" data-testid="professional-card" data-slug={p.slug}>
      <div className="relative aspect-[16/10] w-full bg-muted">
        {fallback ? (
          <DemoPhoto photo={fallback} width={800} height={500} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="size-full" imgClassName="transition-transform duration-300 group-hover:scale-[1.02]" alt="" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- served by our own signed/public image route
          <img src={publicImageHref(p.coverFileId ?? "", "medium")} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {sponsored && (
            <Badge variant="secondary" className="bg-gold/90 text-foreground">
              Sponsorisé
            </Badge>
          )}
          {p.isDemo && <Badge variant="outline" className="bg-background/90">Démo</Badge>}
        </div>
        {fallback && <span className="absolute right-2 bottom-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] text-muted-foreground">Photo d'illustration</span>}
        {!hideFavorite && (
          <div className="absolute top-1.5 right-1.5">
            <FavoriteButton professionalId={p.id} isFavorite={p.isFavorite} signedIn={signedIn} className="bg-background/80 hover:bg-background" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-primary">{p.categoryName}</p>
          <h3 className="font-heading text-lg leading-tight font-semibold">
            <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
              {p.displayName}
            </Link>
          </h3>
          {p.tagline && <p className="line-clamp-2 text-sm text-muted-foreground">{p.tagline}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {(p.city || p.departmentName) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {p.city ?? p.departmentName}
              {p.distanceKm !== null && <span className="text-xs">· {p.distanceKm} km</span>}
            </span>
          )}
          {p.averageRating !== null && p.reviewCount > 0 && (
            <span className="inline-flex items-center gap-1" aria-label={`Note moyenne ${p.averageRating.toFixed(1)} sur 5, ${p.reviewCount} avis`}>
              <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
              {p.averageRating.toFixed(1)} <span className="text-xs">({p.reviewCount})</span>
            </span>
          )}
          {p.acceptsChildrenServices && (
            <span className="inline-flex items-center gap-1 text-xs">
              <Baby className="size-3.5" aria-hidden="true" />
              Enfants bienvenus
            </span>
          )}
        </div>
        {p.topServices.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Prestations principales">
            {p.topServices.map((s) => (
              <li key={s} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {s}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="space-y-1">
            {price && <p className="text-sm font-medium">{price}</p>}
            <VerificationBadge level={p.verificationLevel} />
          </div>
          <Button asChild size="sm" variant="outline" className="relative z-10">
            <Link href={`${href}#contact`}>Contacter</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
