import { and, eq, inArray } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { planFeatures, plans, subscriptions } from "@/db/schema";
import { PaymentRequiredError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import type { FeatureKey } from "@/modules/billing/domain/plans";
import { grantsAccess } from "@/modules/billing/domain/subscription-status";

/**
 * Entitlements are the single source of truth for "is this feature available
 * to this account". They are resolved server side from the active subscription
 * (or the default free plan) — never from a client flag or a checkout redirect.
 */
export type PlanAudience = "organizer" | "professional";

export type EffectivePlan = {
  planId: string;
  planKey: string;
  planName: string;
  audience: PlanAudience;
  isPaid: boolean;
  subscriptionId: string | null;
  status: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  features: Map<string, { enabled: boolean; limit: number | null }>;
};

/** Statuses that still grant access (grace period for past_due until period end). */
const GRANTING_STATUSES = ["active", "trialing", "past_due"] as const;

export async function getEffectivePlan(userId: string, audience: PlanAudience, professionalId?: string | null, executor: DbExecutor = db): Promise<EffectivePlan> {
  const now = new Date();
  const subs = await executor
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      professionalId: subscriptions.professionalId,
      planId: plans.id,
      planKey: plans.key,
      planName: plans.name,
      priceMonthlyCents: plans.priceMonthlyCents,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(and(eq(subscriptions.userId, userId), eq(plans.audience, audience), inArray(subscriptions.status, [...GRANTING_STATUSES])));

  // Scoped to a listing when asked; a subscription without professionalId applies to all listings of the owner.
  const active = subs.find((s) => {
    if (audience === "professional" && professionalId && s.professionalId && s.professionalId !== professionalId) return false;
    return grantsAccess(s, now);
  });

  let planRow: { id: string; key: string; name: string; priceMonthlyCents: number } | undefined;
  if (active) {
    planRow = { id: active.planId, key: active.planKey, name: active.planName, priceMonthlyCents: active.priceMonthlyCents };
  } else {
    const [def] = await executor
      .select({ id: plans.id, key: plans.key, name: plans.name, priceMonthlyCents: plans.priceMonthlyCents })
      .from(plans)
      .where(and(eq(plans.audience, audience), eq(plans.isDefault, true), eq(plans.isActive, true)))
      .limit(1);
    planRow = def;
  }
  if (!planRow) {
    return { planId: "", planKey: `${audience}_free`, planName: "Gratuit", audience, isPaid: false, subscriptionId: null, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, features: new Map() };
  }
  const feats = await executor.select().from(planFeatures).where(eq(planFeatures.planId, planRow.id));
  return {
    planId: planRow.id,
    planKey: planRow.key,
    planName: planRow.name,
    audience,
    isPaid: planRow.priceMonthlyCents > 0,
    subscriptionId: active?.id ?? null,
    status: active?.status ?? null,
    currentPeriodEnd: active?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: active?.cancelAtPeriodEnd ?? false,
    features: new Map(feats.map((f) => [f.featureKey, { enabled: f.enabled, limit: f.limitValue }])),
  };
}

export function planHasFeature(plan: EffectivePlan, feature: FeatureKey): boolean {
  return plan.features.get(feature)?.enabled === true;
}

export function planFeatureLimit(plan: EffectivePlan, feature: FeatureKey): number | null {
  const f = plan.features.get(feature);
  if (!f?.enabled) return 0;
  return f.limit ?? null; // null = unlimited
}

export async function hasFeature(userId: string, audience: PlanAudience, feature: FeatureKey, professionalId?: string | null): Promise<boolean> {
  const plan = await getEffectivePlan(userId, audience, professionalId);
  return planHasFeature(plan, feature);
}

/** Throws PaymentRequiredError (402) → UI shows the contextual paywall. */
export async function requireFeature(actor: Actor, audience: PlanAudience, feature: FeatureKey, professionalId?: string | null): Promise<EffectivePlan> {
  const plan = await getEffectivePlan(actor.userId, audience, professionalId);
  if (!planHasFeature(plan, feature)) throw new PaymentRequiredError();
  return plan;
}

/**
 * Numeric limit for a feature: `null` = unlimited, `0` = feature disabled.
 * Callers compare with their own count (e.g. events created) and raise
 * PaymentRequiredError when `used >= limit`.
 */
export async function getFeatureLimit(userId: string, audience: PlanAudience, feature: FeatureKey, professionalId?: string | null): Promise<number | null> {
  const plan = await getEffectivePlan(userId, audience, professionalId);
  return planFeatureLimit(plan, feature);
}

export type LimitUsage = { limit: number | null; used: number; remaining: number | null; reached: boolean };

/** Combines a plan limit with a usage count computed by the calling module. */
export function getLimitUsage(plan: EffectivePlan, feature: FeatureKey, used: number): LimitUsage {
  const limit = planFeatureLimit(plan, feature);
  if (limit === null) return { limit: null, used, remaining: null, reached: false };
  return { limit, used, remaining: Math.max(0, limit - used), reached: used >= limit };
}
