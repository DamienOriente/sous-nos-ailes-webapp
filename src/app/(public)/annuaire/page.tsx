import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section } from "@/components/shared/section";
import { DirectoryHeader } from "@/components/directory/directory-header";
import { DirectoryResults } from "@/components/directory/directory-results";
import { SearchFilters } from "@/components/directory/search-filters";
import { InquiryExample } from "@/components/marketing/mockups";
import { env } from "@/lib/env";
import { getActor } from "@/lib/session";
import { emptyStateSuggestions, searchDirectory } from "@/modules/directory/application/directory-search";
import { parseSearchParams, toQueryString } from "@/modules/directory/domain/search-params";
import { showcasePhoto } from "@/modules/media/demo-photos";
import { listActiveCategories } from "@/modules/professionals/application/professional-service";

export const metadata: Metadata = {
  title: "Annuaire des professionnels de l'évènementiel et de la garde d'enfants",
  description: "Garde d'enfants, animation, traiteurs, lieux, DJ, photographes : cherchez par métier, ville, date et budget. Chaque fiche indique ce qui a été vérifié.",
  alternates: { canonical: new URL("/annuaire", env.APP_URL).toString() },
};

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseSearchParams(sp);
  const actor = await getActor();
  const [categories, result, suggestions] = await Promise.all([listActiveCategories(), searchDirectory(filters, actor?.userId ?? null), emptyStateSuggestions()]);
  const hasQuery = Object.values(toQueryString(filters)).length > 0;
  const childcare = categories.filter((c) => c.isChildcare);
  const groups = [...new Set(categories.map((c) => c.group))];
  return (
    <Section>
      <Container size="wide" className="space-y-8">
        <DirectoryHeader title="Annuaire des professionnels" photos={hasQuery ? [] : [showcasePhoto("directoryA"), showcasePhoto("directoryB"), showcasePhoto("directoryC")]}>
          <p className="max-w-2xl text-muted-foreground text-pretty">La garde d'enfants et l'animation passent en premier, puis les autres métiers de la réception. Chaque fiche est relue avant publication, et les vérifications affichées décrivent ce que nous avons réellement contrôlé.</p>
        </DirectoryHeader>
        <SearchFilters filters={filters} categories={categories.map((c) => ({ slug: c.slug, name: c.name, group: c.group }))} signedIn={Boolean(actor)} />
        {!hasQuery && (
          <nav aria-label="Métiers de la garde d'enfants" className="flex flex-wrap gap-2">
            {childcare.map((c) => (
              <Link key={c.slug} href={`/annuaire/${c.slug}`} className="inline-flex items-center rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted">
                {c.name}
              </Link>
            ))}
            <Link href="/annuaire#metiers" className="inline-flex items-center rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted">
              Tous les métiers
            </Link>
          </nav>
        )}
        <DirectoryResults result={result} filters={filters} basePath="/annuaire" signedIn={Boolean(actor)} suggestions={suggestions.categories} />
        <section id="metiers" aria-labelledby="metiers-title">
          <h2 id="metiers-title" className="font-heading text-2xl font-semibold">
            Parcourir par métier
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((g) => (
              <div key={g}>
                <h3 className="font-semibold">{g}</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {categories
                    .filter((c) => c.group === g)
                    .map((c) => (
                      <li key={c.slug}>
                        <Link href={`/annuaire/${c.slug}`} className="text-primary underline-offset-4 hover:underline">
                          {c.name}
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        <section aria-labelledby="demande-title" className="grid gap-6 lg:grid-cols-2 lg:gap-10">
          <div>
            <h2 id="demande-title" className="font-heading text-2xl font-semibold">
              À quoi ressemble une demande
            </h2>
            <p className="mt-2 max-w-md leading-7 text-muted-foreground text-pretty">Depuis chaque fiche, le bouton « Contacter » ouvre un formulaire court. Le professionnel reçoit la date, le lieu, le nombre d'invités et d'enfants, ce qu'il lui faut pour répondre. Aucune donnée de santé n'y transite.</p>
          </div>
          <InquiryExample />
        </section>
      </Container>
    </Section>
  );
}
