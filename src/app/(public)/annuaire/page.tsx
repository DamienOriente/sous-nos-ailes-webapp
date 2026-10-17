import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section } from "@/components/shared/section";
import { DirectoryResults } from "@/components/directory/directory-results";
import { SearchFilters } from "@/components/directory/search-filters";
import { CategoryIcon } from "@/components/professionals/category-icons";
import { env } from "@/lib/env";
import { getActor } from "@/lib/session";
import { emptyStateSuggestions, searchDirectory } from "@/modules/directory/application/directory-search";
import { parseSearchParams, toQueryString } from "@/modules/directory/domain/search-params";
import { listActiveCategories } from "@/modules/professionals/application/professional-service";

export const metadata: Metadata = {
  title: "Annuaire des professionnels de l'évènementiel et de la garde d'enfants",
  description: "Trouvez des professionnels vérifiés pour votre mariage, baptême ou séminaire : garde d'enfants, animation, traiteurs, lieux, DJ, photographes. Filtres par ville, date et budget.",
  alternates: { canonical: new URL("/annuaire", env.APP_URL).toString() },
};

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseSearchParams(sp);
  const actor = await getActor();
  const [categories, result, suggestions] = await Promise.all([listActiveCategories(), searchDirectory(filters, actor?.userId ?? null), emptyStateSuggestions()]);
  const hasQuery = Object.values(toQueryString(filters)).length > 0;
  const childcare = categories.filter((c) => c.isChildcare);
  return (
    <Section className="py-8 sm:py-12">
      <Container size="wide" className="space-y-8">
        <header className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Annuaire</p>
          <h1 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Des professionnels vérifiés pour votre évènement</h1>
          <p className="text-muted-foreground text-pretty">Garde d'enfants et animation en priorité, puis tous les métiers de la réception. Chaque fiche est relue avant publication ; les vérifications affichées décrivent exactement ce que nous avons contrôlé.</p>
        </header>
        <SearchFilters filters={filters} categories={categories.map((c) => ({ slug: c.slug, name: c.name, group: c.group }))} signedIn={Boolean(actor)} />
        {!hasQuery && (
          <nav aria-label="Métiers de la garde d'enfants" className="flex flex-wrap gap-2">
            {childcare.map((c) => (
              <Link key={c.slug} href={`/annuaire/${c.slug}`} className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-muted">
                <CategoryIcon icon={c.icon} className="size-4 text-primary" />
                {c.name}
              </Link>
            ))}
            <Link href="/annuaire#metiers" className="inline-flex items-center rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
              Tous les métiers
            </Link>
          </nav>
        )}
        <DirectoryResults result={result} filters={filters} basePath="/annuaire" signedIn={Boolean(actor)} suggestions={suggestions.categories} />
        <section id="metiers" aria-labelledby="metiers-title" className="space-y-4 border-t pt-8">
          <h2 id="metiers-title" className="font-heading text-xl font-semibold">
            Parcourir par métier
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/annuaire/${c.slug}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm hover:bg-muted">
                  <CategoryIcon icon={c.icon} className="size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">{c.group}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </Section>
  );
}
