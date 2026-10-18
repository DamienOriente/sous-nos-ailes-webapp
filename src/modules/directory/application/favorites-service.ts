import { and, desc, eq, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalCategories, professionalFavorites, professionals } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { isPublicListing } from "@/modules/directory/application/public-listing";

/** Toggle a favourite on a published listing. Returns the new state. */
export async function toggleFavorite(actor: Actor, professionalId: string, executor: DbExecutor = db): Promise<{ isFavorite: boolean }> {
  const [pro] = await executor.select({ id: professionals.id }).from(professionals).where(and(eq(professionals.id, professionalId), isPublicListing(), isNull(professionals.deletedAt))).limit(1);
  if (!pro) throw new NotFoundError();
  const deleted = await executor.delete(professionalFavorites).where(and(eq(professionalFavorites.userId, actor.userId), eq(professionalFavorites.professionalId, professionalId))).returning({ id: professionalFavorites.professionalId });
  if (deleted.length) return { isFavorite: false };
  await executor.insert(professionalFavorites).values({ userId: actor.userId, professionalId }).onConflictDoNothing();
  return { isFavorite: true };
}

export async function listFavorites(actor: Actor, executor: DbExecutor = db) {
  return executor
    .select({ id: professionals.id, slug: professionals.slug, displayName: professionals.displayName, city: professionals.city, categoryName: professionalCategories.name, addedAt: professionalFavorites.createdAt })
    .from(professionalFavorites)
    .innerJoin(professionals, eq(professionals.id, professionalFavorites.professionalId))
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(and(eq(professionalFavorites.userId, actor.userId), isNull(professionals.deletedAt)))
    .orderBy(desc(professionalFavorites.createdAt));
}

export async function isFavorite(userId: string, professionalId: string, executor: DbExecutor = db): Promise<boolean> {
  const [row] = await executor.select({ p: professionalFavorites.professionalId }).from(professionalFavorites).where(and(eq(professionalFavorites.userId, userId), eq(professionalFavorites.professionalId, professionalId))).limit(1);
  return Boolean(row);
}
