import { and, eq, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalCategories, professionals } from "@/db/schema";
import { findDepartmentByCode, findDepartmentBySlug, slugifyGeo } from "@/modules/professionals/domain/geo";

export type IndexablePath = { path: string; categorySlug: string; geoSlug: string | null; count: number };

/**
 * Directory paths worth indexing: a category page when it has ≥ 1 published
 * (non-demo) listing, and category × department / category × city pages on
 * the same condition. Consumed by the sitemap (pages/SEO module).
 */
export async function listIndexableDirectoryPaths(executor: DbExecutor = db): Promise<IndexablePath[]> {
  const rows = await executor
    .select({ categorySlug: professionalCategories.slug, department: professionals.department, city: professionals.city, n: sql<number>`count(*)::int` })
    .from(professionals)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(and(eq(professionals.status, "published"), isNull(professionals.deletedAt), eq(professionals.isDemo, false), eq(professionalCategories.isActive, true)))
    .groupBy(professionalCategories.slug, professionals.department, professionals.city);

  const byCategory = new Map<string, number>();
  const byDept = new Map<string, number>();
  const byCity = new Map<string, number>();
  for (const r of rows) {
    byCategory.set(r.categorySlug, (byCategory.get(r.categorySlug) ?? 0) + r.n);
    if (r.department) {
      const d = findDepartmentByCode(r.department);
      if (d) byDept.set(`${r.categorySlug}|${d.slug}`, (byDept.get(`${r.categorySlug}|${d.slug}`) ?? 0) + r.n);
    }
    if (r.city) {
      const key = `${r.categorySlug}|${slugifyGeo(r.city)}`;
      byCity.set(key, (byCity.get(key) ?? 0) + r.n);
    }
  }
  const out: IndexablePath[] = [];
  for (const [categorySlug, count] of byCategory) out.push({ path: `/annuaire/${categorySlug}`, categorySlug, geoSlug: null, count });
  for (const [key, count] of byDept) {
    const [categorySlug, geoSlug] = key.split("|") as [string, string];
    out.push({ path: `/annuaire/${categorySlug}/${geoSlug}`, categorySlug, geoSlug, count });
  }
  for (const [key, count] of byCity) {
    const [categorySlug, geoSlug] = key.split("|") as [string, string];
    if (!byDept.has(key)) out.push({ path: `/annuaire/${categorySlug}/${geoSlug}`, categorySlug, geoSlug, count });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Resolves the second URL segment of a geo page: a department slug, or a city
 * slug having ≥ 1 published listing in the category. Returns null → 404.
 */
export async function resolveGeoSegment(categorySlug: string, segment: string, executor: DbExecutor = db): Promise<{ kind: "department"; code: string; name: string } | { kind: "city"; name: string } | null> {
  const dept = findDepartmentBySlug(segment);
  if (dept) {
    const [r] = await executor
      .select({ n: sql<number>`count(*)::int` })
      .from(professionals)
      .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
      .where(and(eq(professionalCategories.slug, categorySlug), eq(professionals.department, dept.code), eq(professionals.status, "published"), isNull(professionals.deletedAt)));
    return (r?.n ?? 0) > 0 ? { kind: "department", code: dept.code, name: dept.name } : null;
  }
  const cities = await executor
    .selectDistinct({ city: professionals.city })
    .from(professionals)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(and(eq(professionalCategories.slug, categorySlug), eq(professionals.status, "published"), isNull(professionals.deletedAt), sql`${professionals.city} is not null`));
  const match = cities.find((c) => c.city && slugifyGeo(c.city) === segment);
  return match?.city ? { kind: "city", name: match.city } : null;
}
