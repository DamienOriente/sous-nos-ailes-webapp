import { and, desc, eq, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalReviews, professionals, reports, users } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireProfessionalManage } from "@/modules/authorization";
import { openModerationCase } from "@/modules/moderation/application/moderation-service";
import { audit } from "./audit";

export async function listReviewsForManage(actor: Actor, professionalId: string, executor: DbExecutor = db) {
  await requireProfessionalManage(actor, professionalId, executor);
  return executor
    .select({
      id: professionalReviews.id,
      rating: professionalReviews.rating,
      title: professionalReviews.title,
      body: professionalReviews.body,
      status: professionalReviews.status,
      replyBody: professionalReviews.replyBody,
      repliedAt: professionalReviews.repliedAt,
      createdAt: professionalReviews.createdAt,
      authorName: users.name,
    })
    .from(professionalReviews)
    .innerJoin(users, eq(users.id, professionalReviews.authorUserId))
    .where(eq(professionalReviews.professionalId, professionalId))
    .orderBy(desc(professionalReviews.createdAt));
}

/** Public reviews of a published listing (first name only). */
export async function listPublishedReviews(professionalId: string, limit = 20, executor: DbExecutor = db) {
  const rows = await executor
    .select({ id: professionalReviews.id, rating: professionalReviews.rating, title: professionalReviews.title, body: professionalReviews.body, replyBody: professionalReviews.replyBody, repliedAt: professionalReviews.repliedAt, createdAt: professionalReviews.createdAt, authorName: users.name })
    .from(professionalReviews)
    .innerJoin(users, eq(users.id, professionalReviews.authorUserId))
    .where(and(eq(professionalReviews.professionalId, professionalId), eq(professionalReviews.status, "published")))
    .orderBy(desc(professionalReviews.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, authorName: r.authorName.split(/\s+/)[0] ?? "" }));
}

/** Right of reply: once, on a published review. */
export async function replyToReview(actor: Actor, professionalId: string, reviewId: string, replyBody: string, executor: DbExecutor = db): Promise<void> {
  await requireProfessionalManage(actor, professionalId, executor);
  const body = replyBody.trim();
  if (body.length < 2 || body.length > 1000) throw new ValidationError("La réponse doit contenir entre 2 et 1000 caractères.");
  const [review] = await executor.select({ id: professionalReviews.id, replyBody: professionalReviews.replyBody, status: professionalReviews.status }).from(professionalReviews).where(and(eq(professionalReviews.id, reviewId), eq(professionalReviews.professionalId, professionalId))).limit(1);
  if (!review) throw new NotFoundError();
  if (review.status !== "published") throw new ConflictError("Seul un avis publié peut recevoir une réponse.");
  if (review.replyBody) throw new ConflictError("Vous avez déjà répondu à cet avis.");
  await executor.update(professionalReviews).set({ replyBody: body, repliedAt: new Date() }).where(eq(professionalReviews.id, reviewId));
  await audit({ actorUserId: actor.userId, action: "review.replied", resourceType: "review", resourceId: reviewId, metadata: { professionalId } }, executor);
}

export async function reportReview(actor: Actor, professionalId: string, reviewId: string, reason: "inappropriate" | "fake_review" | "spam" | "other", details: string): Promise<void> {
  await db.transaction(async (tx) => {
    await requireProfessionalManage(actor, professionalId, tx);
    const [review] = await tx.select({ id: professionalReviews.id }).from(professionalReviews).where(and(eq(professionalReviews.id, reviewId), eq(professionalReviews.professionalId, professionalId))).limit(1);
    if (!review) throw new NotFoundError();
    const [existing] = await tx.select({ id: reports.id }).from(reports).where(and(eq(reports.resourceType, "review"), eq(reports.resourceId, reviewId), eq(reports.reporterUserId, actor.userId))).limit(1);
    if (existing) throw new ConflictError("Vous avez déjà signalé cet avis.");
    const { caseId } = await openModerationCase({ kind: "review_moderation", resourceType: "review", resourceId: reviewId, professionalId, openedByUserId: actor.userId, summary: `Avis signalé par le professionnel (${reason}).` }, tx);
    await tx.insert(reports).values({ reporterUserId: actor.userId, resourceType: "review", resourceId: reviewId, reason, details: details.slice(0, 1000) || null, caseId });
    await audit({ actorUserId: actor.userId, action: "review.reported", resourceType: "review", resourceId: reviewId, metadata: { professionalId, reason } }, tx);
  });
}

/** Recomputes the denormalised rating on the listing (called after moderation publishes/hides a review). */
export async function refreshRating(professionalId: string, executor: DbExecutor = db): Promise<void> {
  const [agg] = await executor
    .select({ avg: sql<number | null>`avg(rating)::float`, n: sql<number>`count(*)::int` })
    .from(professionalReviews)
    .where(and(eq(professionalReviews.professionalId, professionalId), eq(professionalReviews.status, "published")));
  await executor.update(professionals).set({ averageRating: agg?.avg ?? null, reviewCount: agg?.n ?? 0 }).where(eq(professionals.id, professionalId));
}
