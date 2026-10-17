import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section } from "@/components/shared/section";
import { DemoPhoto } from "@/components/shared/demo-photo";
import { DirectoryHeader } from "@/components/directory/directory-header";
import { DirectoryResults } from "@/components/directory/directory-results";
import { SearchFilters } from "@/components/directory/search-filters";
import { InquiryExample } from "@/components/marketing/mockups";
import { CategoryIcon } from "@/components/professionals/category-icons";
import { env } from "@/lib/env";
import { getActor } from "@/lib/session";
import { emptyStateSuggestions, searchDirectory } from "@/modules/directory/application/directory-search";
import { parseSearchParams, toQueryString } from "@/modules/directory/domain/search-params";
import { categoryPhoto, showcasePhoto } from "@/modules/media/demo-photos";
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
        <DirectoryHeader eyebrow="Annuaire" title="Des professionnels vérifiés pour votre évènement" photos={hasQuery ? [] : [showcasePhoto("directoryA"), showcasePhoto("directoryB"), showcasePhoto("directoryC")]}>
          <p className="max-w-2xl text-muted-foreground text-pretty">Garde d'enfants et animation en priorité, puis tous les métiers de la réception. Chaque fiche est relue avant publication ; les vérifications affichées décrivent exactement ce que nous avons contrôlé.</p>
        </DirectoryHeader>
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
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/annuaire/${c.slug}`} className="group flex items-center gap-3 rounded-2xl border bg-card p-2 pr-4 text-sm transition-colors hover:border-primary/60">
                  <DemoPhoto photo={categoryPhoto(c.slug, 0)} width={240} height={240} sizes="56px" className="size-14 shrink-0 rounded-xl" alt="" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CategoryIcon icon={c.icon} className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">{c.group}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="font-heading text-sm text-muted-foreground italic">Vignettes d'illustration.</p>
        </section>
        <section aria-labelledby="demande-title" className="grid gap-6 border-t pt-8 lg:grid-cols-2 lg:gap-10">
          <div>
            <h2 id="demande-title" className="font-heading text-xl font-semibold">
              À quoi ressemble une demande
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground text-pretty">Depuis chaque fiche, le bouton « Contacter » ouvre un formulaire court. Le professionnel reçoit la date, le lieu, le nombre d'invités et d'enfants : de quoi répondre vite et juste. Aucune donnée de santé n'y transite.</p>
          </div>
          <InquiryExample />
        </section>
      </Container>
    </Section>
  );
}
