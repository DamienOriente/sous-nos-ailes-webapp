import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { featuredPlacements, planFeatures, plans, professionals, subscriptions } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { grantsAccess } from "@/modules/billing/domain/subscription-status";
import { getSetting } from "@/modules/admin/application/settings-service";
import { recordAudit } from "@/modules/admin/application/audit";

/**
 * Sponsored placements. Eligibility is checked at creation AND at query time:
 * a listing that loses its Premium plan or gets unpublished disappears from the
 * sponsored slots immediately. The directory module applies the per-query cap
 * (`sponsored.max_per_query`) and labels every result "Sponsorisé".
 */
export type FeaturedPlacementInput = { professionalId: string; categorySlug?: string | null; department?: string | null; startsAt: Date; endsAt: Date };

export async function isSponsoredEligible(professionalId: string, executor: DbExecutor = db): Promise<{ eligible: boolean; reason?: string }> {
  const [pro] = await executor.select({ status: professionals.status, ownerUserId: professionals.ownerUserId }).from(professionals).where(eq(professionals.id, professionalId)).limit(1);
  if (!pro) return { eligible: false, reason: "Fiche introuvable." };
  if (pro.status !== "published") return { eligible: false, reason: "La fiche n'est pas publiée." };
  const rows = await executor
    .select({ status: subscriptions.status, currentPeriodEnd: subscriptions.currentPeriodEnd, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd, professionalId: subscriptions.professionalId, enabled: planFeatures.enabled })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .innerJoin(planFeatures, and(eq(planFeatures.planId, plans.id), eq(planFeatures.featureKey, "sponsored.eligible")))
    .where(and(eq(subscriptions.userId, pro.ownerUserId), eq(plans.audience, "professional")));
  const ok = rows.some((r) => r.enabled && (!r.professionalId || r.professionalId === professionalId) && grantsAccess(r));
  return ok ? { eligible: true } : { eligible: false, reason: "L'offre du professionnel n'inclut pas les emplacements sponsorisés." };
}

export async function createFeaturedPlacement(actor: Actor, input: FeaturedPlacementInput, executor: DbExecutor = db) {
  requireGlobalPermission(actor, "admin.plans.manage");
  if (input.endsAt <= input.startsAt) throw new ValidationError("La fin doit être postérieure au début.");
  const eligibility = await isSponsoredEligible(input.professionalId, executor);
  if (!eligibility.eligible) throw new ValidationError(eligibility.reason ?? "Professionnel non éligible.");
  const [row] = await executor
    .insert(featuredPlacements)
    .values({ professionalId: input.professionalId, categorySlug: input.categorySlug || null, department: input.department || null, startsAt: input.startsAt, endsAt: input.endsAt })
    .returning({ id: featuredPlacements.id });
  await recordAudit(executor, { actorUserId: actor.userId, action: "billing.placement.created", resourceType: "featured_placement", resourceId: row?.id ?? null, metadata: { professionalId: input.professionalId, categorySlug: input.categorySlug ?? null, department: input.department ?? null } });
  return row;
}

export async function setFeaturedPlacementActive(actor: Actor, id: string, isActive: boolean, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "admin.plans.manage");
  const [row] = await executor.update(featuredPlacements).set({ isActive }).where(eq(featuredPlacements.id, id)).returning({ id: featuredPlacements.id });
  if (!row) throw new NotFoundError();
  await recordAudit(executor, { actorUserId: actor.userId, action: isActive ? "billing.placement.activated" : "billing.placement.deactivated", resourceType: "featured_placement", resourceId: id });
}

export type PlacementPhase = "upcoming" | "running" | "ended";

export async function listFeaturedPlacementsAdmin(actor: Actor) {
  requireGlobalPermission(actor, "admin.plans.manage");
  const now = Date.now();
  const rows = await db
    .select({
      id: featuredPlacements.id,
      professionalId: featuredPlacements.professionalId,
      displayName: professionals.displayName,
      proStatus: professionals.status,
      categorySlug: featuredPlacements.categorySlug,
      department: featuredPlacements.department,
      startsAt: featuredPlacements.startsAt,
      endsAt: featuredPlacements.endsAt,
      isActive: featuredPlacements.isActive,
    })
    .from(featuredPlacements)
    .innerJoin(professionals, eq(professionals.id, featuredPlacements.professionalId))
    .orderBy(desc(featuredPlacements.startsAt));
  return rows.map((r) => ({ ...r, phase: (r.endsAt.getTime() < now ? "ended" : r.startsAt.getTime() > now ? "upcoming" : "running") as PlacementPhase }));
}

/**
 * CONTRACT for the directory module: active, eligible placements matching a
 * search, capped by `sponsored.max_per_query`. Returns professional ids in a
 * stable order (soonest to expire first, so rotation is fair).
 */
export async function listActiveSponsoredProfessionalIds(filter: { categorySlug?: string | null; department?: string | null }, executor: DbExecutor = db): Promise<string[]> {
  const cap = await getSetting<number>("sponsored.max_per_query", 2, executor);
  if (cap <= 0) return [];
  const now = new Date();
  const conds = [eq(featuredPlacements.isActive, true), lte(featuredPlacements.startsAt, now), gte(featuredPlacements.endsAt, now), eq(professionals.status, "published")];
  if (filter.categorySlug) conds.push(sql`(${featuredPlacements.categorySlug} is null or ${featuredPlacements.categorySlug} = ${filter.categorySlug})`);
  if (filter.department) conds.push(sql`(${featuredPlacements.department} is null or ${featuredPlacements.department} = ${filter.department})`);
  const rows = await executor
    .select({ professionalId: featuredPlacements.professionalId })
    .from(featuredPlacements)
    .innerJoin(professionals, eq(professionals.id, featuredPlacements.professionalId))
    .where(and(...conds))
    .orderBy(featuredPlacements.endsAt)
    .limit(cap * 3);
  const out: string[] = [];
  for (const r of rows) {
    if (out.includes(r.professionalId)) continue;
    const e = await isSponsoredEligible(r.professionalId, executor);
    if (e.eligible) out.push(r.professionalId);
    if (out.length >= cap) break;
  }
  return out;
}
