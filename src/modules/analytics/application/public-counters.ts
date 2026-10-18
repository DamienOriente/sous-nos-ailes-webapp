import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalCategories, professionals } from "@/db/schema";
import { isPublicListing } from "@/modules/directory/application/public-listing";

/**
 * Real numbers for the public site. Nothing here is estimated or rounded up:
 * if the database is empty the home page says nothing rather than inventing.
 * Demo listings are counted separately so the UI can label them.
 */
export type PublicCounters = {
  publishedProfessionals: number;
  demoProfessionals: number;
  childcareProfessionals: number;
  cities: Array<{ city: string; department: string | null; count: number }>;
};

export async function getPublicCounters(executor: DbExecutor = db): Promise<PublicCounters> {
  const published = and(isPublicListing(), isNull(professionals.deletedAt));
  const [totals] = await executor
    .select({
      total: sql<number>`count(*)::int`,
      demo: sql<number>`count(*) filter (where ${professionals.isDemo})::int`,
      childcare: sql<number>`count(*) filter (where ${professionals.acceptsChildrenServices})::int`,
    })
    .from(professionals)
    .where(published);
  const cities = await executor
    .select({ city: professionals.city, department: professionals.department, count: sql<number>`count(*)::int` })
    .from(professionals)
    .where(and(published, sql`${professionals.city} is not null and ${professionals.city} <> ''`))
    .groupBy(professionals.city, professionals.department)
    .orderBy(desc(sql`count(*)`), asc(professionals.city))
    .limit(12);
  return {
    publishedProfessionals: totals?.total ?? 0,
    demoProfessionals: totals?.demo ?? 0,
    childcareProfessionals: totals?.childcare ?? 0,
    cities: cities.filter((c): c is { city: string; department: string | null; count: number } => typeof c.city === "string"),
  };
}

export type PublicCategory = { slug: string; name: string; description: string | null; group: string; icon: string; isChildcare: boolean };

export async function getActiveCategories(executor: DbExecutor = db): Promise<PublicCategory[]> {
  return executor
    .select({ slug: professionalCategories.slug, name: professionalCategories.name, description: professionalCategories.description, group: professionalCategories.group, icon: professionalCategories.icon, isChildcare: professionalCategories.isChildcare })
    .from(professionalCategories)
    .where(eq(professionalCategories.isActive, true))
    .orderBy(asc(professionalCategories.sortOrder), asc(professionalCategories.name));
}
