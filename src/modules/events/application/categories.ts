import { asc, eq } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalCategories } from "@/db/schema";

export type CategoryOption = { slug: string; name: string; group: string; isChildcare: boolean };

/** Active trade categories for selects (shared by several event pages). */
export async function getCategoryOptions(executor: DbExecutor = db): Promise<CategoryOption[]> {
  return executor
    .select({ slug: professionalCategories.slug, name: professionalCategories.name, group: professionalCategories.group, isChildcare: professionalCategories.isChildcare })
    .from(professionalCategories)
    .where(eq(professionalCategories.isActive, true))
    .orderBy(asc(professionalCategories.sortOrder));
}
