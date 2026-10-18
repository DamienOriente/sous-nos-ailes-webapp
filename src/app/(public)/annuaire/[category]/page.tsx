import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/shared/section";
import { Breadcrumbs, CategoryFaq, CategoryIntro, CategoryJsonLd, geoTitle } from "@/components/directory/category-seo";
import { DirectoryHeader } from "@/components/directory/directory-header";
import { DirectoryResults } from "@/components/directory/directory-results";
import { SearchFilters } from "@/components/directory/search-filters";
import { InquiryExample } from "@/components/marketing/mockups";
import { env } from "@/lib/env";
import { getActor } from "@/lib/session";
import { emptyStateSuggestions, searchDirectory } from "@/modules/directory/application/directory-search";
import { listIndexableDirectoryPaths } from "@/modules/directory/application/directory-paths";
import { parseSearchParams } from "@/modules/directory/domain/search-params";
import { categoryPhoto } from "@/modules/media/demo-photos";
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
    description: `${cat.description ?? cat.name} Comparez les prestations, les tarifs et les vérifications de professionnels relus par notre équipe. Contact gratuit.`,
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
  // One exact, reserved photo per trade: never a photo that a listing on the page also shows.
  const photos = [categoryPhoto(cat.slug, 0)];
  return (
    <Section>
      <Container size="wide" className="space-y-8">
        <CategoryJsonLd title={title} path={path} items={result.items} breadcrumbs={breadcrumbs} />
        <Breadcrumbs items={breadcrumbs} />
        <DirectoryHeader title={title} photos={photos}>
          <CategoryIntro categoryName={cat.name} categoryDescription={cat.description} isChildcare={cat.isChildcare} geo={null} total={result.total} />
        </DirectoryHeader>
        <SearchFilters filters={filters} categories={categories.map((c) => ({ slug: c.slug, name: c.name, group: c.group }))} action={path} lockedCategory signedIn={Boolean(actor)} />
        <DirectoryResults result={result} filters={filters} basePath={path} signedIn={Boolean(actor)} suggestions={suggestions.categories} />
        {geoLinks.length > 0 && (
          <nav aria-label="Par zone" className="space-y-2">
            <h2 className="font-heading text-2xl font-semibold">{cat.name} par zone</h2>
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
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <CategoryFaq categoryName={cat.name} isChildcare={cat.isChildcare} geo={null} />
          <section aria-labelledby="demande-title" className="space-y-3">
            <h2 id="demande-title" className="font-heading text-2xl font-semibold">
              Exemple de demande de devis
            </h2>
            <InquiryExample categoryName={cat.name} />
          </section>
        </div>
      </Container>
    </Section>
  );
}
