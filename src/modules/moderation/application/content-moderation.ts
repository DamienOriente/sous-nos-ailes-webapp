import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { messages, professionalReviews, professionals, reports, users } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { refreshRating } from "@/modules/professionals/application/review-service";
import { notify } from "@/modules/notifications/application/notification-service";
import { recordAudit } from "@/modules/admin/application/audit";

// ── Reviews ──────────────────────────────────────────────────────────────────
export async function listReviewsForModeration(actor: Actor, opts: { status?: "pending" | "published" | "rejected" | "hidden"; limit?: number } = {}) {
  requireGlobalPermission(actor, "moderation.queue");
  return db
    .select({ id: professionalReviews.id, rating: professionalReviews.rating, title: professionalReviews.title, body: professionalReviews.body, status: professionalReviews.status, moderationNote: professionalReviews.moderationNote, createdAt: professionalReviews.createdAt, professionalId: professionalReviews.professionalId, professionalName: professionals.displayName, authorName: users.name })
    .from(professionalReviews)
    .innerJoin(professionals, eq(professionals.id, professionalReviews.professionalId))
    .innerJoin(users, eq(users.id, professionalReviews.authorUserId))
    .where(opts.status ? eq(professionalReviews.status, opts.status) : undefined)
    .orderBy(sql`case ${professionalReviews.status} when 'pending' then 0 else 1 end`, desc(professionalReviews.createdAt))
    .limit(opts.limit ?? 200);
}

export async function moderateReview(actor: Actor, reviewId: string, status: "published" | "hidden" | "rejected", note: string): Promise<void> {
  requireGlobalPermission(actor, "moderation.decide");
  if (status !== "published" && note.trim().length < 10) throw new ValidationError("Motivez le masquage ou le refus (10 caractères minimum).");
  const [review] = await db.select({ id: professionalReviews.id, professionalId: professionalReviews.professionalId, authorUserId: professionalReviews.authorUserId, status: professionalReviews.status }).from(professionalReviews).where(eq(professionalReviews.id, reviewId)).limit(1);
  if (!review) throw new NotFoundError();
  await db.transaction(async (tx) => {
    await tx.update(professionalReviews).set({ status, moderationNote: note.trim() || null }).where(eq(professionalReviews.id, reviewId));
    await refreshRating(review.professionalId, tx);
    await recordAudit(tx, { actorUserId: actor.userId, action: `review.${status}`, resourceType: "review", resourceId: reviewId, metadata: { professionalId: review.professionalId, from: review.status }, reason: note.trim() || null });
    if (status !== "published") {
      await notify({ userId: review.authorUserId, type: "system", title: status === "hidden" ? "Votre avis a été masqué" : "Votre avis n'a pas été publié", body: note.trim(), href: "/app/notifications" }, tx);
    }
  });
}

// ── Reported messages ────────────────────────────────────────────────────────
/**
 * Moderators read ONLY the reported message, never the channel. A message is
 * readable when it was flagged (`reportedAt`) or has a report row.
 */
export async function getReportedMessage(actor: Actor, messageId: string) {
  requireGlobalPermission(actor, "moderation.queue");
  const [row] = await db
    .select({ id: messages.id, body: messages.body, eventId: messages.eventId, authorName: users.name, createdAt: messages.createdAt, deletedAt: messages.deletedAt, reportedAt: messages.reportedAt, reportCount: sql<number>`(select count(*)::int from ${reports} where ${reports.resourceType} = 'message' and ${reports.resourceId} = ${messages.id}::text)` })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.authorUserId))
    .where(and(eq(messages.id, messageId), or(isNotNull(messages.reportedAt), sql`exists (select 1 from ${reports} where ${reports.resourceType} = 'message' and ${reports.resourceId} = ${messages.id}::text)`)))
    .limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

export async function hideReportedMessage(actor: Actor, messageId: string, reason: string): Promise<void> {
  requireGlobalPermission(actor, "moderation.decide");
  if (reason.trim().length < 10) throw new ValidationError("Motivez le masquage (10 caractères minimum).");
  const msg = await getReportedMessage(actor, messageId);
  await db.transaction(async (tx) => {
    await tx.update(messages).set({ deletedAt: new Date(), body: "[Message masqué par la modération]" }).where(eq(messages.id, msg.id));
    await recordAudit(tx, { actorUserId: actor.userId, action: "message.hidden_by_moderation", resourceType: "message", resourceId: msg.id, eventId: msg.eventId, reason: reason.trim() });
  });
}
