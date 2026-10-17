import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { billingEvents, planFeatures, plans, professionals, subscriptions, users } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { FEATURES, type FeatureKey } from "@/modules/billing/domain/plans";
import { grantsAccess } from "@/modules/billing/domain/subscription-status";
import { recordAudit } from "@/modules/admin/application/audit";

/**
 * Back-office management of plans and features. Changing a plan never rewrites
 * an existing subscription: Stripe prices are immutable (a new Price is created
 * on next checkout) and local rows keep their plan id. The UI shows how many
 * subscriptions are affected and the change is audited.
 */
export type PlanUpdate = { name?: string; description?: string; priceMonthlyCents?: number; isActive?: boolean; isDefault?: boolean; sortOrder?: number };

export async function listPlansAdmin(actor: Actor) {
  requireGlobalPermission(actor, "admin.plans.manage");
  const rows = await db.select().from(plans).orderBy(asc(plans.sortOrder));
  const feats = rows.length ? await db.select().from(planFeatures).where(inArray(planFeatures.planId, rows.map((p) => p.id))) : [];
  const counts = await db
    .select({ planId: subscriptions.planId, status: subscriptions.status, currentPeriodEnd: subscriptions.currentPeriodEnd, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd })
    .from(subscriptions);
  return rows.map((p) => ({
    ...p,
    features: Object.fromEntries(feats.filter((f) => f.planId === p.id).map((f) => [f.featureKey, { enabled: f.enabled, limit: f.limitValue }])) as Record<string, { enabled: boolean; limit: number | null }>,
    activeSubscriptions: counts.filter((c) => c.planId === p.id && grantsAccess(c)).length,
  }));
}

export async function updatePlan(actor: Actor, planId: string, patch: PlanUpdate, executor: DbExecutor = db): Promise<{ affectedSubscriptions: number }> {
  requireGlobalPermission(actor, "admin.plans.manage");
  const [plan] = await executor.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!plan) throw new NotFoundError();
  if (patch.priceMonthlyCents !== undefined && (patch.priceMonthlyCents < 0 || patch.priceMonthlyCents > 100_000)) throw new ValidationError("Prix invalide.");
  if (patch.name !== undefined && patch.name.trim().length < 2) throw new ValidationError("Nom trop court.");

  const affectedRows = await executor.select({ n: count() }).from(subscriptions).where(and(eq(subscriptions.planId, planId), inArray(subscriptions.status, ["active", "trialing", "past_due"])));
  const affected = affectedRows[0]?.n ?? 0;
  const priceChanged = patch.priceMonthlyCents !== undefined && patch.priceMonthlyCents !== plan.priceMonthlyCents;

  await executor.transaction(async (tx) => {
    if (patch.isDefault) {
      await tx.update(plans).set({ isDefault: false }).where(and(eq(plans.audience, plan.audience), eq(plans.isDefault, true)));
    }
    await tx
      .update(plans)
      .set({
        name: patch.name?.trim() ?? plan.name,
        description: patch.description ?? plan.description,
        priceMonthlyCents: patch.priceMonthlyCents ?? plan.priceMonthlyCents,
        isActive: patch.isActive ?? plan.isActive,
        isDefault: patch.isDefault ?? plan.isDefault,
        sortOrder: patch.sortOrder ?? plan.sortOrder,
        // A new price means a new Stripe Price on the next checkout; the old one keeps billing existing customers.
        ...(priceChanged ? { stripePriceId: null } : {}),
      })
      .where(eq(plans.id, planId));
    await recordAudit(tx, {
      actorUserId: actor.userId,
      action: "billing.plan.updated",
      resourceType: "plan",
      resourceId: planId,
      metadata: { before: { price: plan.priceMonthlyCents, isActive: plan.isActive, isDefault: plan.isDefault }, after: patch, existingSubscriptionsUntouched: affected },
    });
  });
  return { affectedSubscriptions: affected };
}

export async function setPlanFeature(actor: Actor, planId: string, featureKey: FeatureKey, enabled: boolean, limit: number | null, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "admin.plans.manage");
  if (!(featureKey in FEATURES)) throw new ValidationError("Fonctionnalité inconnue.");
  if (limit !== null && (!Number.isInteger(limit) || limit < 0)) throw new ValidationError("Limite invalide.");
  await executor
    .insert(planFeatures)
    .values({ planId, featureKey, enabled, limitValue: limit })
    .onConflictDoUpdate({ target: [planFeatures.planId, planFeatures.featureKey], set: { enabled, limitValue: limit } });
  await recordAudit(executor, { actorUserId: actor.userId, action: "billing.plan.feature_updated", resourceType: "plan", resourceId: planId, metadata: { featureKey, enabled, limit } });
}

export async function createPlan(actor: Actor, input: { key: string; name: string; audience: "organizer" | "professional"; priceMonthlyCents: number; description?: string }, executor: DbExecutor = db) {
  requireGlobalPermission(actor, "admin.plans.manage");
  if (!/^[a-z][a-z0-9_]{2,40}$/.test(input.key)) throw new ValidationError("Clé invalide (minuscules, chiffres, _).");
  const [dup] = await executor.select({ id: plans.id }).from(plans).where(eq(plans.key, input.key)).limit(1);
  if (dup) throw new ConflictError("Cette clé existe déjà.");
  const countRows = await executor.select({ n: count() }).from(plans);
  const n = countRows[0]?.n ?? 0;
  const [row] = await executor.insert(plans).values({ key: input.key, name: input.name, audience: input.audience, priceMonthlyCents: input.priceMonthlyCents, description: input.description ?? "", sortOrder: n + 1, isActive: false }).returning({ id: plans.id });
  await recordAudit(executor, { actorUserId: actor.userId, action: "billing.plan.created", resourceType: "plan", resourceId: row?.id ?? null, metadata: { key: input.key } });
  return row;
}

export type SubscriptionRow = {
  id: string;
  status: string;
  provider: string;
  planName: string;
  planKey: string;
  priceMonthlyCents: number;
  userEmail: string;
  userIsDemo: boolean;
  professionalName: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
};

export async function listSubscriptionsAdmin(actor: Actor, opts: { status?: string; limit?: number } = {}): Promise<SubscriptionRow[]> {
  requireGlobalPermission(actor, "admin.billing.view");
  const rows = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      provider: subscriptions.provider,
      planName: plans.name,
      planKey: plans.key,
      priceMonthlyCents: plans.priceMonthlyCents,
      userEmail: users.email,
      userIsDemo: users.isDemo,
      professionalName: professionals.displayName,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .leftJoin(professionals, eq(professionals.id, subscriptions.professionalId))
    .where(opts.status ? sql`${subscriptions.status} = ${opts.status}` : undefined)
    .orderBy(desc(subscriptions.createdAt))
    .limit(opts.limit ?? 200);
  return rows;
}

export type MrrSummary = { totalCents: number; demoCents: number; realCents: number; byPlan: Array<{ planKey: string; planName: string; count: number; cents: number }>; isDemoOnly: boolean };

/** MRR = sum of monthly prices of subscriptions that currently grant access. Demo (mock provider / demo user) is separated. */
export async function computeMrr(executor: DbExecutor = db): Promise<MrrSummary> {
  const rows = await executor
    .select({ status: subscriptions.status, currentPeriodEnd: subscriptions.currentPeriodEnd, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd, provider: subscriptions.provider, isDemo: users.isDemo, planKey: plans.key, planName: plans.name, price: plans.priceMonthlyCents })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .innerJoin(users, eq(users.id, subscriptions.userId));
  const byPlan = new Map<string, { planKey: string; planName: string; count: number; cents: number }>();
  let demoCents = 0;
  let realCents = 0;
  for (const r of rows) {
    if (!grantsAccess(r) || r.price <= 0) continue;
    const isDemo = r.provider === "mock" || r.isDemo;
    if (isDemo) demoCents += r.price;
    else realCents += r.price;
    const entry = byPlan.get(r.planKey) ?? { planKey: r.planKey, planName: r.planName, count: 0, cents: 0 };
    entry.count += 1;
    entry.cents += r.price;
    byPlan.set(r.planKey, entry);
  }
  return { totalCents: demoCents + realCents, demoCents, realCents, byPlan: [...byPlan.values()], isDemoOnly: realCents === 0 && demoCents > 0 };
}

export async function listRecentBillingEvents(actor: Actor, limit = 50) {
  requireGlobalPermission(actor, "admin.billing.view");
  return db.select({ id: billingEvents.id, provider: billingEvents.provider, externalEventId: billingEvents.externalEventId, type: billingEvents.type, processedAt: billingEvents.processedAt, error: billingEvents.error, createdAt: billingEvents.createdAt }).from(billingEvents).orderBy(desc(billingEvents.createdAt)).limit(limit);
}

export async function countBillingEventsSince(since: Date, executor: DbExecutor = db): Promise<number> {
  const [r] = await executor.select({ n: count() }).from(billingEvents).where(gte(billingEvents.createdAt, since));
  return r?.n ?? 0;
}
