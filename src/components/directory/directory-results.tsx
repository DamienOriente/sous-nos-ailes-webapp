import Link from "next/link";
import { Info } from "lucide-react";
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
        <section aria-labelledby="sponsored-title" className="rounded-2xl border border-gold/50 bg-gold/10 p-4 sm:p-5" data-testid="sponsored-block">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="sponsored-title" className="text-sm font-semibold">
              Sponsorisé
            </h2>
            <Link href="/classements-sponsorises" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Info className="size-3.5" aria-hidden="true" />
              Pourquoi ces résultats apparaissent ici
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {result.sponsored.map((p) => (
              <ProfessionalCard key={p.id} professional={p} signedIn={signedIn} sponsored />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="results-title">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="results-title" className="text-sm text-muted-foreground" data-testid="results-count">
            {result.total === 0 ? "Aucun résultat" : result.total === 1 ? "1 professionnel" : `${result.total} professionnels`}
            {result.origin ? ` · distance depuis ${result.origin.label}` : ""}
          </h2>
          <p className="text-xs text-muted-foreground">Classement : pertinence métier, proximité, disponibilité, complétude, vérifications. Les sponsorisés sont séparés et étiquetés.</p>
        </div>
        {result.items.length === 0 ? (
          <div role="status" className="grid items-center gap-6 rounded-3xl border border-dashed bg-card/60 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)]">
            <EmptyNestScene className="mx-auto max-w-[16rem]" />
            <div>
              <h3 className="text-lg font-semibold">Le nid est vide pour cette recherche</h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground text-pretty">Élargissez le rayon, retirez un critère ou explorez les métiers déjà présents. Les professionnels sont ajoutés chaque semaine.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/annuaire">Réinitialiser les filtres</Link>
                </Button>
                {suggestions.slice(0, 5).map((s) => (
                  <Button key={s.slug} asChild variant="ghost" size="sm">
                    <Link href={`/annuaire/${s.slug}`}>
                      {s.name} ({s.count})
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="results-grid">
            {/* A listing already shown in the sponsored block is not repeated below (same card, same photo twice). */}
            {result.items.filter((p) => !result.sponsored.some((s) => s.id === p.id)).map((p) => (
              <li key={p.id}>
                <ProfessionalCard professional={p} signedIn={signedIn} />
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
