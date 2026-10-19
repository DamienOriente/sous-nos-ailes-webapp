import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { EmptyNestScene } from "@/components/illustrations";
import { ProfessionalCard } from "@/components/directory/professional-card";
import type { DirectoryResult } from "@/modules/directory/application/directory-search";
import { toQueryString, type SearchFilters } from "@/modules/directory/domain/search-params";

export function DirectoryResults({
  result,
  filters,
  basePath,
  signedIn,
  suggestions,
}: {
  result: DirectoryResult;
  filters: SearchFilters;
  basePath: string;
  signedIn: boolean;
  suggestions: Array<{ slug: string; name: string; count: number }>;
}) {
  const pageHref = (page: number) => `${basePath}${toQueryString({ ...filters, page })}`;
  return (
    <div className="space-y-8">
      {result.sponsored.length > 0 && (
        <section aria-labelledby="sponsored-title" className="rounded-2xl border bg-muted/50 p-4 sm:p-6" data-testid="sponsored-block">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="sponsored-title" className="text-sm font-semibold">
              Sponsorisé
            </h2>
            <Link href="/classements-sponsorises" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Pourquoi ces résultats apparaissent ici
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {result.sponsored.map((p) => (
              <ProfessionalCard key={p.id} professional={p} signedIn={signedIn} sponsored date={filters.date || undefined} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="results-title">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="results-title" className="text-sm text-muted-foreground" data-testid="results-count">
            {result.total === 0 ? "Aucun résultat" : result.total === 1 ? "1 professionnel" : `${result.total} professionnels`}
            {filters.date ? `, libres le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${filters.date}T12:00:00Z`))}` : ""}
            {result.origin ? `, distance depuis ${result.origin.label}` : ""}
          </h2>
          <p className="text-xs text-muted-foreground">
            {filters.date ? "Disponibilité vérifiée sur l'agenda de chaque professionnel : réservations, indisponibilités, calendriers synchronisés et options en cours. " : ""}
            Ordre des résultats : métier, proximité, disponibilité, fiche complète, vérifications. Les résultats sponsorisés sont séparés et étiquetés.
          </p>
        </div>
        {result.items.length === 0 ? (
          <div role="status" className="grid items-center gap-6 rounded-3xl border border-dashed bg-card p-6 sm:p-8 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)]">
            <EmptyNestScene className="mx-auto max-w-[16rem]" />
            <div>
              <h3 className="text-lg font-semibold">Aucun professionnel ne correspond à cette recherche</h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground text-pretty">Élargissez le rayon, retirez un critère ou choisissez un métier déjà présent dans l'annuaire.</p>
              <div className="mt-5">
                <Button asChild variant="outline" size="sm">
                  <Link href="/annuaire">Réinitialiser les filtres</Link>
                </Button>
              </div>
              {suggestions.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  {suggestions.slice(0, 5).map((s) => (
                    <li key={s.slug}>
                      <Link href={`/annuaire/${s.slug}`} className="text-primary underline-offset-4 hover:underline">
                        {s.name} ({s.count})
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="results-grid">
            {/* A listing already shown in the sponsored block is not repeated below (same card, same photo twice). */}
            {result.items.filter((p) => !result.sponsored.some((s) => s.id === p.id)).map((p) => (
              <li key={p.id}>
                <ProfessionalCard professional={p} signedIn={signedIn} date={filters.date || undefined} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {result.pageCount > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href={pageHref(Math.max(1, result.page - 1))} aria-disabled={result.page === 1} className={result.page === 1 ? "pointer-events-none opacity-50" : ""} />
            </PaginationItem>
            {Array.from({ length: result.pageCount })
              .map((_, i) => i + 1)
              .filter((n) => Math.abs(n - result.page) <= 2 || n === 1 || n === result.pageCount)
              .map((n) => (
                <PaginationItem key={n}>
                  <PaginationLink href={pageHref(n)} isActive={n === result.page}>
                    {n}
                  </PaginationLink>
                </PaginationItem>
              ))}
            <PaginationItem>
              <PaginationNext href={pageHref(Math.min(result.pageCount, result.page + 1))} aria-disabled={result.page === result.pageCount} className={result.page === result.pageCount ? "pointer-events-none opacity-50" : ""} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
