import { and, asc, eq, ilike, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalCategories, professionalRecommendations, professionals } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireProfessionalManage } from "@/modules/authorization";
import { isPublicListing } from "@/modules/directory/application/public-listing";
import { notify } from "@/modules/notifications/application/notification-service";
import { audit } from "./audit";

/**
 * Network between professionals (2026-10-19): a professional recommends the partners they work
 * with; "often booked with" is computed from confirmed bookings on the same events (at least two
 * distinct events, so a single collaboration never reveals who worked where).
 */
export const MAX_RECOMMENDATIONS = 12;
export const CO_BOOKING_MIN_EVENTS = 2;

export type PartnerCard = { id: string; slug: string; displayName: string; categoryName: string; city: string | null; note: string | null };

const card = { id: professionals.id, slug: professionals.slug, displayName: professionals.displayName, categoryName: professionalCategories.name, city: professionals.city };

export async function listMyRecommendations(actor: Actor, professionalId: string, executor: DbExecutor = db) {
  await requireProfessionalManage(actor, professionalId, executor);
  return executor
    .select({ ...card, note: professionalRecommendations.note, recommendationId: professionalRecommendations.id })
    .from(professionalRecommendations)
    .innerJoin(professionals, eq(professionals.id, professionalRecommendations.recommendedProfessionalId))
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(eq(professionalRecommendations.professionalId, professionalId))
    .orderBy(asc(professionalRecommendations.sortOrder), asc(professionals.displayName));
}

/** Published professionals matching a name, not yet recommended (partner picker). */
export async function searchPartnerCandidates(actor: Actor, professionalId: string, q: string, executor: DbExecutor = db) {
  await requireProfessionalManage(actor, professionalId, executor);
  const term = q.trim();
  if (term.length < 2) return [];
  const already = (await executor.select({ id: professionalRecommendations.recommendedProfessionalId }).from(professionalRecommendations).where(eq(professionalRecommendations.professionalId, professionalId))).map((r) => r.id);
  return executor
    .select(card)
    .from(professionals)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(and(isPublicListing(), ne(professionals.id, professionalId), ilike(professionals.displayName, `%${term.replace(/[%_]/g, "")}%`), already.length ? notInArray(professionals.id, already) : undefined))
    .orderBy(asc(professionals.displayName))
    .limit(10);
}

export async function addRecommendation(actor: Actor, professionalId: string, recommendedId: string, note: string): Promise<void> {
  await db.transaction(async (tx) => {
    await requireProfessionalManage(actor, professionalId, tx);
    if (recommendedId === professionalId) throw new ValidationError("Vous ne pouvez pas vous recommander vous-même.");
    const [target] = await tx.select({ id: professionals.id, ownerUserId: professionals.ownerUserId }).from(professionals).where(and(eq(professionals.id, recommendedId), isPublicListing())).limit(1);
    if (!target) throw new NotFoundError("Ce professionnel n'est pas publié.");
    const [n] = await tx.select({ n: sql<number>`count(*)::int` }).from(professionalRecommendations).where(eq(professionalRecommendations.professionalId, professionalId));
    if ((n?.n ?? 0) >= MAX_RECOMMENDATIONS) throw new ConflictError(`${MAX_RECOMMENDATIONS} partenaires au plus : retirez-en un d'abord.`);
    const inserted = await tx
      .insert(professionalRecommendations)
      .values({ professionalId, recommendedProfessionalId: recommendedId, note: note.trim().slice(0, 280) || null, sortOrder: n?.n ?? 0 })
      .onConflictDoNothing()
      .returning({ id: professionalRecommendations.id });
    if (!inserted.length) throw new ConflictError("Ce partenaire est déjà dans votre liste.");
    const [me] = await tx.select({ displayName: professionals.displayName }).from(professionals).where(eq(professionals.id, professionalId)).limit(1);
    await notify({ userId: target.ownerUserId, type: "system", title: `${me?.displayName ?? "Un professionnel"} vous recommande`, body: "Votre fiche apparaît parmi ses partenaires sur sa page publique.", href: `/pro/${professionalId}`, dedupeKey: `reco:${professionalId}:${recommendedId}` }, tx);
    await audit({ actorUserId: actor.userId, action: "professional.recommendation_added", resourceType: "professional", resourceId: professionalId, metadata: { recommendedId } }, tx);
  });
}

export async function removeRecommendation(actor: Actor, professionalId: string, recommendationId: string): Promise<void> {
  await requireProfessionalManage(actor, professionalId);
  const res = await db.delete(professionalRecommendations).where(and(eq(professionalRecommendations.id, recommendationId), eq(professionalRecommendations.professionalId, professionalId))).returning({ id: professionalRecommendations.id });
  if (!res.length) throw new NotFoundError();
}

/** Public: partners the professional recommends (published ones only). */
export async function getRecommendedPartners(professionalId: string, executor: DbExecutor = db): Promise<PartnerCard[]> {
  return executor
    .select({ ...card, note: professionalRecommendations.note })
    .from(professionalRecommendations)
    .innerJoin(professionals, eq(professionals.id, professionalRecommendations.recommendedProfessionalId))
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(and(eq(professionalRecommendations.professionalId, professionalId), isPublicListing()))
    .orderBy(asc(professionalRecommendations.sortOrder))
    .limit(MAX_RECOMMENDATIONS);
}

/** Public: professionals confirmed on the same events at least twice, most frequent first. */
export async function getOftenBookedWith(professionalId: string, limit = 6, executor: DbExecutor = db): Promise<(PartnerCard & { events: number })[]> {
  const rows = await executor.execute<{ id: string; events: number }>(sql`
    select other.professional_id as id, count(distinct other.event_id)::int as events
    from event_professionals me
    join event_professionals other on other.event_id = me.event_id and other.professional_id is not null and other.professional_id <> me.professional_id and other.status = 'confirmed'
    join events e on e.id = me.event_id and e.deleted_at is null and e.status <> 'cancelled'
    where me.professional_id = ${professionalId}::uuid and me.status = 'confirmed'
    group by other.professional_id
    having count(distinct other.event_id) >= ${CO_BOOKING_MIN_EVENTS}
    order by events desc
    limit ${limit}`);
  const ids = rows.rows.map((r) => r.id);
  if (!ids.length) return [];
  const cards = await executor.select(card).from(professionals).innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId)).where(and(inArray(professionals.id, ids), isPublicListing()));
  const byId = new Map(cards.map((c) => [c.id, c]));
  return rows.rows.flatMap((r) => {
    const c = byId.get(r.id);
    return c ? [{ ...c, note: null, events: r.events }] : [];
  });
}
