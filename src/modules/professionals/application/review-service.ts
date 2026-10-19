import { and, desc, eq, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventMembers, eventProfessionals, events, inquiries, professionalReviews, professionals, reports, users } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireProfessionalManage } from "@/modules/authorization";
import { openModerationCase } from "@/modules/moderation/application/moderation-service";
import { audit } from "./audit";
import { isPublicListing } from "@/modules/directory/application/public-listing";
import { notify } from "@/modules/notifications/application/notification-service";
import { ORGANIZER_ROLES, verifiedLabel, type ReviewInput } from "@/modules/professionals/domain/review-eligibility";

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

/** Public reviews of a published listing (first name only), verified ones only, with what proves them. */
export async function listPublishedReviews(professionalId: string, limit = 20, executor: DbExecutor = db) {
  const rows = await executor
    .select({ id: professionalReviews.id, rating: professionalReviews.rating, title: professionalReviews.title, body: professionalReviews.body, replyBody: professionalReviews.replyBody, repliedAt: professionalReviews.repliedAt, createdAt: professionalReviews.createdAt, authorName: users.name, eventType: events.type, eventDate: events.eventDate, inquiryLabel: inquiries.eventTypeLabel, inquiryDate: inquiries.eventDate })
    .from(professionalReviews)
    .innerJoin(users, eq(users.id, professionalReviews.authorUserId))
    .leftJoin(events, eq(events.id, professionalReviews.eventId))
    .leftJoin(inquiries, eq(inquiries.id, professionalReviews.inquiryId))
    .where(and(eq(professionalReviews.professionalId, professionalId), eq(professionalReviews.status, "published"), isNotNull(professionalReviews.verifiedVia)))
    .orderBy(desc(professionalReviews.createdAt))
    .limit(limit);
  return rows.map(({ eventType, eventDate, inquiryLabel, inquiryDate, ...r }) => ({ ...r, authorName: r.authorName.split(/\s+/)[0] ?? "", verifiedLabel: eventType ? verifiedLabel(eventType, eventDate) : verifiedLabel(inquiryLabel, inquiryDate) }));
}

// ── Verified reviews (organiser side) ──────────────────────────────────────
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

export type ReviewOpportunity = { professionalId: string; professionalName: string; slug: string; eventId: string | null; inquiryId: string | null; label: string; date: string | null };

/**
 * Collaborations the actor may review: confirmed providers of an event they organise whose day
 * is over, and bookings a professional confirmed for them (outside an event they organise).
 * Already reviewed ones are left out.
 */
export async function listReviewOpportunities(actor: Actor, executor: DbExecutor = db): Promise<ReviewOpportunity[]> {
  const day = today();
  const fromEvents = await executor
    .select({ professionalId: professionals.id, professionalName: professionals.displayName, slug: professionals.slug, eventId: events.id, eventName: events.name, date: events.eventDate })
    .from(eventMembers)
    .innerJoin(events, eq(events.id, eventMembers.eventId))
    .innerJoin(eventProfessionals, and(eq(eventProfessionals.eventId, events.id), eq(eventProfessionals.status, "confirmed")))
    .innerJoin(professionals, eq(professionals.id, eventProfessionals.professionalId))
    .where(and(eq(eventMembers.userId, actor.userId), eq(eventMembers.status, "active"), inArray(eventMembers.role, [...ORGANIZER_ROLES]), isNull(events.deletedAt), ne(events.status, "cancelled"), lt(events.eventDate, day), ne(professionals.ownerUserId, actor.userId)));
  const fromInquiries = await executor
    .select({ professionalId: professionals.id, professionalName: professionals.displayName, slug: professionals.slug, inquiryId: inquiries.id, label: inquiries.eventTypeLabel, date: inquiries.eventDate, eventId: inquiries.eventId })
    .from(inquiries)
    .innerJoin(professionals, eq(professionals.id, inquiries.professionalId))
    .where(and(eq(inquiries.requesterUserId, actor.userId), eq(inquiries.status, "confirmed"), lt(inquiries.eventDate, day)));
  const mine = await executor.select({ professionalId: professionalReviews.professionalId, eventId: professionalReviews.eventId, inquiryId: professionalReviews.inquiryId }).from(professionalReviews).where(eq(professionalReviews.authorUserId, actor.userId));
  const reviewedEvent = new Set(mine.filter((m) => m.eventId).map((m) => `${m.professionalId}:${m.eventId}`));
  const reviewedInquiry = new Set(mine.filter((m) => m.inquiryId).map((m) => m.inquiryId));
  const out: ReviewOpportunity[] = [];
  const seen = new Set<string>();
  for (const r of fromEvents) {
    const key = `${r.professionalId}:${r.eventId}`;
    if (reviewedEvent.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ professionalId: r.professionalId, professionalName: r.professionalName, slug: r.slug, eventId: r.eventId, inquiryId: null, label: r.eventName, date: r.date });
  }
  for (const r of fromInquiries) {
    // Inquiry linked to an event already offered above: one review per collaboration.
    if (reviewedInquiry.has(r.inquiryId) || (r.eventId && (seen.has(`${r.professionalId}:${r.eventId}`) || reviewedEvent.has(`${r.professionalId}:${r.eventId}`)))) continue;
    out.push({ professionalId: r.professionalId, professionalName: r.professionalName, slug: r.slug, eventId: null, inquiryId: r.inquiryId, label: r.label ?? "Prestation", date: r.date });
  }
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Creates a review only for a proven, finished collaboration; it goes to moderation before publication. */
export async function createVerifiedReview(actor: Actor, input: ReviewInput): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const eligible = await listReviewOpportunities(actor, tx);
    const match = eligible.find((o) => o.professionalId === input.professionalId && (input.eventId ? o.eventId === input.eventId : o.inquiryId === input.inquiryId));
    if (!match) throw new NotFoundError("Aucune prestation terminée avec ce professionnel ne permet de laisser un avis.");
    const [pro] = await tx.select({ id: professionals.id, ownerUserId: professionals.ownerUserId, displayName: professionals.displayName }).from(professionals).where(and(eq(professionals.id, input.professionalId), isPublicListing())).limit(1);
    if (!pro) throw new NotFoundError();
    const [row] = await tx
      .insert(professionalReviews)
      .values({ professionalId: pro.id, authorUserId: actor.userId, eventId: match.eventId, inquiryId: match.inquiryId, rating: input.rating, title: input.title || null, body: input.body, status: "pending", verifiedVia: match.eventId ? "event" : "inquiry" })
      .returning({ id: professionalReviews.id });
    if (!row) throw new ConflictError("Vous avez déjà donné votre avis sur cette prestation.");
    await audit({ actorUserId: actor.userId, action: "review.created", resourceType: "review", resourceId: row.id, metadata: { professionalId: pro.id, via: match.eventId ? "event" : "inquiry" } }, tx);
    await notify({ userId: pro.ownerUserId, type: "system", title: "Un client a laissé un avis", body: "Il sera publié sur votre page après relecture par notre équipe.", href: `/app/pro/${pro.id}/avis` }, tx);
    return row;
  });
}

/** Reviews the actor wrote, with their moderation status. */
export async function listMyReviews(actor: Actor, executor: DbExecutor = db) {
  return executor
    .select({ id: professionalReviews.id, rating: professionalReviews.rating, title: professionalReviews.title, status: professionalReviews.status, createdAt: professionalReviews.createdAt, professionalName: professionals.displayName, slug: professionals.slug })
    .from(professionalReviews)
    .innerJoin(professionals, eq(professionals.id, professionalReviews.professionalId))
    .where(eq(professionalReviews.authorUserId, actor.userId))
    .orderBy(desc(professionalReviews.createdAt));
}

/** Organisers of events whose day was yesterday, with confirmed providers to rate (worker, daily). */
export async function remindReviewsAfterEvents(executor: DbExecutor = db): Promise<number> {
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() - 86_400_000));
  const rows = await executor
    .select({ userId: eventMembers.userId, eventId: events.id, eventName: events.name })
    .from(events)
    .innerJoin(eventMembers, and(eq(eventMembers.eventId, events.id), eq(eventMembers.status, "active"), inArray(eventMembers.role, [...ORGANIZER_ROLES])))
    .where(and(eq(events.eventDate, yesterday), isNull(events.deletedAt), ne(events.status, "cancelled"), sql`exists (select 1 from event_professionals ep where ep.event_id = ${events.id} and ep.status = 'confirmed' and ep.professional_id is not null)`));
  for (const r of rows) {
    await notify({ userId: r.userId, type: "system", title: `Comment s'est passé « ${r.eventName} » ?`, body: "Votre avis sur les professionnels aide les prochains organisateurs. Il est marqué comme vérifié.", href: "/app/avis", eventId: r.eventId, dedupeKey: `review-reminder:${r.eventId}` }, executor);
  }
  return rows.length;
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
    .where(and(eq(professionalReviews.professionalId, professionalId), eq(professionalReviews.status, "published"), isNotNull(professionalReviews.verifiedVia)));
  await executor.update(professionals).set({ averageRating: agg?.avg ?? null, reviewCount: agg?.n ?? 0 }).where(eq(professionals.id, professionalId));
}
