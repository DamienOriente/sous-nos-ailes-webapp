import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/shared/section";
import { Breadcrumbs, CategoryFaq, CategoryIntro, CategoryJsonLd, geoTitle } from "@/components/directory/category-seo";
import { DirectoryResults } from "@/components/directory/directory-results";
import { SearchFilters } from "@/components/directory/search-filters";
import { env } from "@/lib/env";
import { getActor } from "@/lib/session";
import { emptyStateSuggestions, searchDirectory } from "@/modules/directory/application/directory-search";
import { listIndexableDirectoryPaths } from "@/modules/directory/application/directory-paths";
import { parseSearchParams } from "@/modules/directory/domain/search-params";
import { listActiveCategories } from "@/modules/professionals/application/professional-service";
import { findDepartmentBySlug } from "@/modules/professionals/domain/geo";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = (await listActiveCategories()).find((c) => c.slug === category);
  // Thrown here so the 404 status is sent before streaming starts.
  if (!cat) notFound();
  const title = geoTitle(cat.name, null);
  return {
    title,
    description: `${cat.description ?? cat.name} Comparez des professionnels relus par notre équipe, leurs prestations, tarifs et vérifications. Contact gratuit.`,
    alternates: { canonical: new URL(`/annuaire/${cat.slug}`, env.APP_URL).toString() },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const sp = await searchParams;
  const categories = await listActiveCategories();
  const cat = categories.find((c) => c.slug === category);
  if (!cat) notFound();
  const filters = parseSearchParams({ ...sp, category: cat.slug });
  const actor = await getActor();
  const [result, suggestions, paths] = await Promise.all([searchDirectory(filters, actor?.userId ?? null), emptyStateSuggestions(), listIndexableDirectoryPaths()]);
  const title = geoTitle(cat.name, null);
  const path = `/annuaire/${cat.slug}`;
  const geoLinks = paths.filter((p) => p.categorySlug === cat.slug && p.geoSlug).slice(0, 12);
  const breadcrumbs = [
    { name: "Accueil", path: "/" },
    { name: "Annuaire", path: "/annuaire" },
    { name: cat.name, path },
  ];
  return (
    <Section className="py-8 sm:py-12">
      <Container size="wide" className="space-y-8">
        <CategoryJsonLd title={title} path={path} items={result.items} breadcrumbs={breadcrumbs} />
        <Breadcrumbs items={breadcrumbs} />
        <header className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">{cat.group}</p>
          <h1 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">{title}</h1>
          <CategoryIntro categoryName={cat.name} categoryDescription={cat.description} isChildcare={cat.isChildcare} geo={null} total={result.total} />
        </header>
        <SearchFilters filters={filters} categories={categories.map((c) => ({ slug: c.slug, name: c.name, group: c.group }))} action={path} lockedCategory signedIn={Boolean(actor)} />
        <DirectoryResults result={result} filters={filters} basePath={path} signedIn={Boolean(actor)} suggestions={suggestions.categories} />
        {geoLinks.length > 0 && (
          <nav aria-label="Par zone" className="space-y-2">
            <h2 className="font-heading text-xl font-semibold">{cat.name} par zone</h2>
            <ul className="flex flex-wrap gap-2">
              {geoLinks.map((g) => {
                const dept = g.geoSlug ? findDepartmentBySlug(g.geoSlug) : null;
                return (
                  <li key={g.path}>
                    <Link href={g.path} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm hover:bg-muted">
                      {dept ? dept.name : g.geoSlug?.replace(/-/g, " ")} <span className="text-xs text-muted-foreground">({g.count})</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <CategoryFaq categoryName={cat.name} isChildcare={cat.isChildcare} geo={null} />
      </Container>
    </Section>
  );
}
