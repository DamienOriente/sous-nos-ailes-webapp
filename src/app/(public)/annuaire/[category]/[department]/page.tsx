import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/shared/section";
import { Breadcrumbs, CategoryFaq, CategoryIntro, CategoryJsonLd, geoTitle, type GeoContext } from "@/components/directory/category-seo";
import { DirectoryHeader } from "@/components/directory/directory-header";
import { DirectoryResults } from "@/components/directory/directory-results";
import { SearchFilters } from "@/components/directory/search-filters";
import { InquiryExample } from "@/components/marketing/mockups";
import { env } from "@/lib/env";
import { getActor } from "@/lib/session";
import { emptyStateSuggestions, searchDirectory } from "@/modules/directory/application/directory-search";
import { resolveGeoSegment } from "@/modules/directory/application/directory-paths";
import { parseSearchParams } from "@/modules/directory/domain/search-params";
import { categoryPhoto } from "@/modules/media/demo-photos";
import { listActiveCategories } from "@/modules/professionals/application/professional-service";
import { findDepartmentByCode } from "@/modules/professionals/domain/geo";

type Props = { params: Promise<{ category: string; department: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function resolve(categorySlug: string, segment: string) {
  const categories = await listActiveCategories();
  const cat = categories.find((c) => c.slug === categorySlug);
  if (!cat) return null;
  const geo = await resolveGeoSegment(cat.slug, segment);
  if (!geo) return null;
  const ctx: GeoContext = geo.kind === "department" ? { kind: "department", name: geo.name, slug: segment } : { kind: "city", name: geo.name, slug: segment };
  return { categories, cat, geo, ctx };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, department } = await params;
  const r = await resolve(category, department);
  // Thrown here so the 404 status is sent before streaming starts.
  if (!r) notFound();
  const title = geoTitle(r.cat.name, r.ctx);
  return {
    title,
    description: `${title} : professionnels relus par notre équipe, prestations, tarifs indicatifs et vérifications détaillées. Contact gratuit et direct.`,
    alternates: { canonical: new URL(`/annuaire/${r.cat.slug}/${department}`, env.APP_URL).toString() },
  };
}

/**
 * Geo page for category × department or category × city. Only exists when at
 * least one published listing matches (resolveGeoSegment), so no mass
 * generation of thin pages.
 */
export default async function CategoryGeoPage({ params, searchParams }: Props) {
  const { category, department } = await params;
  const sp = await searchParams;
  const r = await resolve(category, department);
  if (!r) notFound();
  const { categories, cat, geo, ctx } = r;
  const filters = parseSearchParams({ ...sp, category: cat.slug, department: geo.kind === "department" ? department : "", city: geo.kind === "city" ? geo.name : "" });
  const actor = await getActor();
  const [result, suggestions] = await Promise.all([searchDirectory(filters, actor?.userId ?? null), emptyStateSuggestions()]);
  const title = geoTitle(cat.name, ctx);
  const path = `/annuaire/${cat.slug}/${department}`;
  const deptName = geo.kind === "department" ? geo.name : result.items[0]?.department ? findDepartmentByCode(result.items[0].department)?.name : null;
  const breadcrumbs = [
    { name: "Accueil", path: "/" },
    { name: "Annuaire", path: "/annuaire" },
    { name: cat.name, path: `/annuaire/${cat.slug}` },
    { name: geo.name, path },
  ];
  return (
    <Section className="py-8 sm:py-12">
      <Container size="wide" className="space-y-8">
        <CategoryJsonLd title={title} path={path} items={result.items} breadcrumbs={breadcrumbs} />
        <Breadcrumbs items={breadcrumbs} />
        <DirectoryHeader eyebrow={deptName && geo.kind === "city" ? `${cat.group} · ${deptName}` : cat.group} title={title} photos={[categoryPhoto(cat.slug, 1)]}>
          <CategoryIntro categoryName={cat.name} categoryDescription={cat.description} isChildcare={cat.isChildcare} geo={ctx} total={result.total} />
        </DirectoryHeader>
        <SearchFilters filters={filters} categories={categories.map((c) => ({ slug: c.slug, name: c.name, group: c.group }))} action={path} lockedCategory lockedGeo signedIn={Boolean(actor)} />
        <DirectoryResults result={result} filters={filters} basePath={path} signedIn={Boolean(actor)} suggestions={suggestions.categories} />
        <div className="grid gap-8 border-t pt-8 lg:grid-cols-2 lg:gap-10">
          <CategoryFaq categoryName={cat.name} isChildcare={cat.isChildcare} geo={ctx} />
          <section aria-labelledby="demande-title" className="space-y-3">
            <h2 id="demande-title" className="font-heading text-xl font-semibold">
              Exemple de demande de devis
            </h2>
            <InquiryExample categoryName={cat.name} />
          </section>
        </div>
      </Container>
    </Section>
  );
}
