import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import { db, type DbExecutor } from "@/db/client";
import { billingCustomers, planFeatures, plans, professionals, subscriptions } from "@/db/schema";
import { env } from "@/lib/env";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireProfessionalManage } from "@/modules/authorization";
import { FEATURES, type FeatureKey } from "@/modules/billing/domain/plans";
import { grantsAccess } from "@/modules/billing/domain/subscription-status";
import { getStripe } from "@/modules/billing/infrastructure/stripe-client";
import { getEffectivePlan, type EffectivePlan, type PlanAudience } from "@/modules/billing/application/entitlements";
import { ingestBillingEvent } from "@/modules/billing/application/webhook-processor";
import { incrementPromoRedemption, validatePromoCode } from "@/modules/billing/application/promo-codes";
import { getSetting } from "@/modules/admin/application/settings-service";
import { recordAudit } from "@/modules/admin/application/audit";

/**
 * Subscription use cases. Two providers behind the same API:
 *  - `stripe` when STRIPE_SECRET_KEY is configured (test keys until go-live),
 *  - `mock` otherwise: an in-app page labelled "Paiement simulé" which feeds the
 *    exact same event processor as the webhook endpoint.
 * The browser redirect after checkout is never trusted: entitlements only change
 * through processed events.
 */
export type CheckoutInput = { planKey: string; audience: PlanAudience; professionalId?: string | null; promoCode?: string | null };
export type CheckoutResult = { provider: "stripe" | "mock"; url: string };

export function billingProvider(): "stripe" | "mock" {
  return getStripe() ? "stripe" : "mock";
}

export async function listPlans(audience?: PlanAudience, executor: DbExecutor = db) {
  const rows = await executor
    .select()
    .from(plans)
    .where(audience ? and(eq(plans.audience, audience), eq(plans.isActive, true)) : eq(plans.isActive, true))
    .orderBy(asc(plans.sortOrder));
  const feats = rows.length ? await executor.select().from(planFeatures).where(inArray(planFeatures.planId, rows.map((p) => p.id))) : [];
  return rows.map((p) => ({ ...p, features: feats.filter((f) => f.planId === p.id).map((f) => ({ key: f.featureKey as FeatureKey, label: FEATURES[f.featureKey as FeatureKey] ?? f.featureKey, enabled: f.enabled, limit: f.limitValue })) }));
}

export type PlanWithFeatures = Awaited<ReturnType<typeof listPlans>>[number];

async function assertAudienceScope(actor: Actor, audience: PlanAudience, professionalId: string | null | undefined, executor: DbExecutor): Promise<string | null> {
  if (audience === "professional") {
    if (!professionalId) throw new ValidationError("Fiche professionnelle requise pour une offre professionnelle.");
    const access = await requireProfessionalManage(actor, professionalId, executor);
    if (access.role !== "owner" && access.role !== "org_admin") throw new ForbiddenError("Seul le propriétaire de la fiche peut gérer son abonnement.");
    return professionalId;
  }
  return null;
}

async function loadPaidPlan(planKey: string, audience: PlanAudience, executor: DbExecutor) {
  const [plan] = await executor.select().from(plans).where(and(eq(plans.key, planKey), eq(plans.audience, audience), eq(plans.isActive, true))).limit(1);
  if (!plan) throw new NotFoundError("Offre introuvable.");
  if (plan.priceMonthlyCents <= 0) throw new ValidationError("Cette offre est gratuite : aucun paiement nécessaire.");
  return plan;
}

async function findCurrentPaidSubscription(userId: string, audience: PlanAudience, professionalId: string | null, executor: DbExecutor) {
  const rows = await executor
    .select({ id: subscriptions.id, status: subscriptions.status, currentPeriodEnd: subscriptions.currentPeriodEnd, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd, professionalId: subscriptions.professionalId, provider: subscriptions.provider, stripeSubscriptionId: subscriptions.stripeSubscriptionId, planKey: plans.key })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(and(eq(subscriptions.userId, userId), eq(plans.audience, audience)));
  return rows.find((r) => (!professionalId || !r.professionalId || r.professionalId === professionalId) && grantsAccess(r)) ?? null;
}

/** Creates the Stripe Product/Price for a plan on first use (test mode) and persists the ids. */
export async function ensureStripePrice(stripe: Stripe, plan: typeof plans.$inferSelect, executor: DbExecutor = db): Promise<string> {
  if (plan.stripePriceId) return plan.stripePriceId;
  let productId = plan.stripeProductId;
  if (!productId) {
    const product = await stripe.products.create({ name: plan.name, description: plan.description || undefined, metadata: { planKey: plan.key, audience: plan.audience } });
    productId = product.id;
  }
  const price = await stripe.prices.create({ product: productId, currency: plan.currency.toLowerCase(), unit_amount: plan.priceMonthlyCents, recurring: { interval: "month" }, metadata: { planKey: plan.key } });
  await executor.update(plans).set({ stripeProductId: productId, stripePriceId: price.id }).where(eq(plans.id, plan.id));
  return price.id;
}

async function ensureStripeCustomer(stripe: Stripe, actor: Actor, executor: DbExecutor): Promise<string> {
  const [existing] = await executor.select().from(billingCustomers).where(eq(billingCustomers.userId, actor.userId)).limit(1);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;
  const customer = await stripe.customers.create({ email: actor.email, name: actor.name, metadata: { userId: actor.userId } });
  await executor
    .insert(billingCustomers)
    .values({ userId: actor.userId, stripeCustomerId: customer.id, email: actor.email })
    .onConflictDoUpdate({ target: billingCustomers.userId, set: { stripeCustomerId: customer.id, email: actor.email } });
  return customer.id;
}

export async function startCheckout(actor: Actor, input: CheckoutInput, executor: DbExecutor = db): Promise<CheckoutResult> {
  const professionalId = await assertAudienceScope(actor, input.audience, input.professionalId, executor);
  const plan = await loadPaidPlan(input.planKey, input.audience, executor);
  const current = await findCurrentPaidSubscription(actor.userId, input.audience, professionalId, executor);
  if (current && current.planKey === plan.key && !current.cancelAtPeriodEnd) throw new ConflictError("Vous êtes déjà abonné à cette offre.");

  let promo: Awaited<ReturnType<typeof validatePromoCode>> | null = null;
  if (input.promoCode) {
    promo = await validatePromoCode(input.promoCode, executor);
    if (!promo.ok) throw new ValidationError(promo.message);
  }

  const returnBase = input.audience === "professional" && professionalId ? `/app/pro/${professionalId}/abonnement` : "/app/compte/abonnement";
  const stripe = getStripe();
  if (!stripe) {
    const params = new URLSearchParams({ plan: plan.key, audience: input.audience });
    if (professionalId) params.set("professionalId", professionalId);
    if (promo?.ok) params.set("promo", promo.promo.code);
    return { provider: "mock", url: `/app/compte/abonnement/mock-checkout?${params.toString()}` };
  }

  const customerId = await ensureStripeCustomer(stripe, actor, executor);
  const priceId = await ensureStripePrice(stripe, plan, executor);
  const metadata = { userId: actor.userId, planKey: plan.key, professionalId: professionalId ?? "" };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: actor.userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.APP_URL}/app/compte/abonnement/retour?session_id={CHECKOUT_SESSION_ID}&audience=${input.audience}${professionalId ? `&professionalId=${professionalId}` : ""}`,
    cancel_url: `${env.APP_URL}${returnBase}?checkout=cancelled`,
    locale: "fr",
    metadata,
    subscription_data: { metadata },
    ...(promo?.ok && promo.promo.stripeCouponId ? { discounts: [{ coupon: promo.promo.stripeCouponId }] } : { allow_promotion_codes: true }),
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  await recordAudit(executor, { actorUserId: actor.userId, action: "billing.checkout.started", resourceType: "plan", resourceId: plan.id, metadata: { provider: "stripe", professionalId } });
  return { provider: "stripe", url: session.url };
}

/**
 * Mock provider: called by the "Simuler un paiement réussi" button. Emits the
 * same events Stripe would send, through the same idempotent processor.
 */
export async function completeMockCheckout(actor: Actor, input: CheckoutInput & { outcome: "success" | "failure" }, executor: DbExecutor = db): Promise<{ subscriptionId: string | null }> {
  if (getStripe()) throw new ConflictError("Le paiement simulé est désactivé quand Stripe est configuré.");
  const professionalId = await assertAudienceScope(actor, input.audience, input.professionalId, executor);
  const plan = await loadPaidPlan(input.planKey, input.audience, executor);
  const promo = input.promoCode ? await validatePromoCode(input.promoCode, executor) : null;
  if (promo && !promo.ok) throw new ValidationError(promo.message);

  const stamp = Date.now();
  const nonce = Math.random().toString(36).slice(2, 10);
  const subId = `mock_sub_${stamp}_${nonce}`;
  const customerId = `mock_cus_${actor.userId.slice(0, 12)}`;
  const nowSec = Math.floor(stamp / 1000);
  const periodEnd = nowSec + 30 * 24 * 3600;
  const metadata = { userId: actor.userId, planKey: plan.key, professionalId: professionalId ?? "" };

  if (input.outcome === "failure") {
    await ingestBillingEvent({
      provider: "mock",
      externalEventId: `mock_evt_${stamp}_${nonce}_failed`,
      type: "checkout.session.expired",
      payload: { id: `mock_evt_${stamp}_${nonce}_failed`, type: "checkout.session.expired", data: { object: { id: `mock_cs_${nonce}`, mode: "subscription", status: "expired", metadata } } },
    });
    return { subscriptionId: null };
  }

  const subscriptionObject = {
    id: subId,
    object: "subscription",
    customer: customerId,
    status: "active",
    cancel_at_period_end: false,
    canceled_at: null,
    ended_at: null,
    metadata,
    items: { data: [{ id: `mock_si_${nonce}`, price: { id: plan.stripePriceId ?? `mock_price_${plan.key}`, unit_amount: promo?.ok ? promo.discountedCents(plan.priceMonthlyCents) : plan.priceMonthlyCents, currency: "eur" }, current_period_start: nowSec, current_period_end: periodEnd }] },
  };
  await ingestBillingEvent({
    provider: "mock",
    externalEventId: `mock_evt_${stamp}_${nonce}_checkout`,
    type: "checkout.session.completed",
    payload: { id: `mock_evt_${stamp}_${nonce}_checkout`, type: "checkout.session.completed", data: { object: { id: `mock_cs_${nonce}`, mode: "subscription", status: "complete", payment_status: "paid", customer: customerId, subscription: subId, client_reference_id: actor.userId, metadata } } },
  });
  await ingestBillingEvent({
    provider: "mock",
    externalEventId: `mock_evt_${stamp}_${nonce}_sub`,
    type: "customer.subscription.created",
    payload: { id: `mock_evt_${stamp}_${nonce}_sub`, type: "customer.subscription.created", data: { object: subscriptionObject } },
  });
  if (promo?.ok) await incrementPromoRedemption(promo.promo.id, executor);
  const [row] = await executor.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subId)).limit(1);
  await recordAudit(executor, { actorUserId: actor.userId, action: "billing.checkout.completed", resourceType: "subscription", resourceId: row?.id ?? null, metadata: { provider: "mock", planKey: plan.key, professionalId } });
  return { subscriptionId: row?.id ?? null };
}

async function loadOwnedSubscription(actor: Actor, subscriptionId: string, executor: DbExecutor) {
  const [sub] = await executor.select().from(subscriptions).where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, actor.userId))).limit(1);
  if (!sub) throw new NotFoundError();
  return sub;
}

/** Mirrors a local change as a provider event so the ledger stays the single history. */
async function emitLocalSubscriptionEvent(sub: typeof subscriptions.$inferSelect, type: "customer.subscription.updated" | "customer.subscription.deleted", patch: Record<string, unknown>) {
  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const id = `mock_evt_${nonce}`;
  const toSec = (d: Date | null) => (d ? Math.floor(d.getTime() / 1000) : null);
  await ingestBillingEvent({
    provider: "mock",
    externalEventId: id,
    type,
    payload: {
      id,
      type,
      data: {
        object: {
          id: sub.stripeSubscriptionId,
          object: "subscription",
          status: sub.status,
          cancel_at_period_end: sub.cancelAtPeriodEnd,
          canceled_at: toSec(sub.canceledAt),
          ended_at: toSec(sub.endedAt),
          current_period_start: toSec(sub.currentPeriodStart),
          current_period_end: toSec(sub.currentPeriodEnd),
          metadata: { userId: sub.userId, professionalId: sub.professionalId ?? "" },
          ...patch,
        },
      },
    },
  });
}

export async function cancelAtPeriodEnd(actor: Actor, subscriptionId: string, executor: DbExecutor = db): Promise<void> {
  const sub = await loadOwnedSubscription(actor, subscriptionId, executor);
  if (!grantsAccess(sub)) throw new ConflictError("Cet abonnement n'est plus actif.");
  if (sub.cancelAtPeriodEnd) return;
  const stripe = getStripe();
  if (sub.provider === "stripe" && stripe && sub.stripeSubscriptionId) {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
    await executor.update(subscriptions).set({ cancelAtPeriodEnd: true, canceledAt: new Date() }).where(eq(subscriptions.id, sub.id));
  } else {
    await emitLocalSubscriptionEvent(sub, "customer.subscription.updated", { cancel_at_period_end: true, canceled_at: Math.floor(Date.now() / 1000) });
  }
  await recordAudit(executor, { actorUserId: actor.userId, action: "billing.subscription.cancel_scheduled", resourceType: "subscription", resourceId: sub.id, metadata: { provider: sub.provider } });
}

export async function resumeSubscription(actor: Actor, subscriptionId: string, executor: DbExecutor = db): Promise<void> {
  const sub = await loadOwnedSubscription(actor, subscriptionId, executor);
  if (!sub.cancelAtPeriodEnd || !grantsAccess(sub)) throw new ConflictError("Aucune résiliation à annuler sur cet abonnement.");
  const stripe = getStripe();
  if (sub.provider === "stripe" && stripe && sub.stripeSubscriptionId) {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
    await executor.update(subscriptions).set({ cancelAtPeriodEnd: false, canceledAt: null }).where(eq(subscriptions.id, sub.id));
  } else {
    await emitLocalSubscriptionEvent(sub, "customer.subscription.updated", { cancel_at_period_end: false, canceled_at: null });
  }
  await recordAudit(executor, { actorUserId: actor.userId, action: "billing.subscription.resumed", resourceType: "subscription", resourceId: sub.id, metadata: { provider: sub.provider } });
}

/** Mock-only: simulates the end of the period (what Stripe does with customer.subscription.deleted). */
export async function simulateMockPeriodEnd(actor: Actor, subscriptionId: string, executor: DbExecutor = db): Promise<void> {
  if (getStripe()) throw new ConflictError("Simulation indisponible quand Stripe est configuré.");
  const sub = await loadOwnedSubscription(actor, subscriptionId, executor);
  if (sub.provider !== "mock") throw new ConflictError("Abonnement non simulé.");
  const now = Math.floor(Date.now() / 1000);
  await emitLocalSubscriptionEvent(sub, "customer.subscription.deleted", { status: "canceled", canceled_at: now, ended_at: now });
}

export async function openCustomerPortal(actor: Actor, returnPath = "/app/compte/abonnement"): Promise<{ provider: "stripe" | "mock"; url: string }> {
  const stripe = getStripe();
  if (!stripe) return { provider: "mock", url: "/app/compte/abonnement/gestion" };
  const [c] = await db.select().from(billingCustomers).where(eq(billingCustomers.userId, actor.userId)).limit(1);
  if (!c?.stripeCustomerId) throw new NotFoundError("Aucun compte de facturation.");
  const session = await stripe.billingPortal.sessions.create({ customer: c.stripeCustomerId, return_url: `${env.APP_URL}${returnPath}`, locale: "fr" });
  return { provider: "stripe", url: session.url };
}

export type InvoiceSummary = { id: string; number: string | null; amountPaidCents: number; currency: string; status: string | null; createdAt: Date; hostedUrl: string | null; pdfUrl: string | null };

export async function listInvoices(actor: Actor): Promise<{ provider: "stripe" | "mock"; invoices: InvoiceSummary[] }> {
  const stripe = getStripe();
  if (!stripe) return { provider: "mock", invoices: [] };
  const [c] = await db.select().from(billingCustomers).where(eq(billingCustomers.userId, actor.userId)).limit(1);
  if (!c?.stripeCustomerId) return { provider: "stripe", invoices: [] };
  const list = await stripe.invoices.list({ customer: c.stripeCustomerId, limit: 24 });
  return {
    provider: "stripe",
    invoices: list.data.map((inv) => ({ id: inv.id, number: inv.number ?? null, amountPaidCents: inv.amount_paid, currency: inv.currency.toUpperCase(), status: inv.status ?? null, createdAt: new Date(inv.created * 1000), hostedUrl: inv.hosted_invoice_url ?? null, pdfUrl: inv.invoice_pdf ?? null })),
  };
}

export type SubscriptionOverview = {
  audience: PlanAudience;
  professionalId: string | null;
  provider: "stripe" | "mock";
  liveEnabled: boolean;
  effective: EffectivePlan;
  subscription: (typeof subscriptions.$inferSelect & { planName: string; planKey: string; priceMonthlyCents: number }) | null;
  history: Array<typeof subscriptions.$inferSelect & { planName: string }>;
  plans: PlanWithFeatures[];
};

export async function getSubscriptionOverview(actor: Actor, audience: PlanAudience, professionalId?: string | null): Promise<SubscriptionOverview> {
  if (audience === "professional" && professionalId) await requireProfessionalManage(actor, professionalId);
  const effective = await getEffectivePlan(actor.userId, audience, professionalId);
  const rows = await db
    .select({ sub: subscriptions, planName: plans.name, planKey: plans.key, priceMonthlyCents: plans.priceMonthlyCents })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(and(eq(subscriptions.userId, actor.userId), eq(plans.audience, audience)))
    .orderBy(desc(subscriptions.createdAt));
  const scoped = rows.filter((r) => !professionalId || !r.sub.professionalId || r.sub.professionalId === professionalId);
  const current = scoped.find((r) => r.sub.id === effective.subscriptionId) ?? null;
  return {
    audience,
    professionalId: professionalId ?? null,
    provider: billingProvider(),
    liveEnabled: await getSetting<boolean>("billing.live_enabled", false),
    effective,
    subscription: current ? { ...current.sub, planName: current.planName, planKey: current.planKey, priceMonthlyCents: current.priceMonthlyCents } : null,
    history: scoped.map((r) => ({ ...r.sub, planName: r.planName })),
    plans: await listPlans(audience),
  };
}

/** Listings the actor can manage: used by the account page to route `audience=professional` paywalls. */
export async function listManageableProfessionals(actor: Actor) {
  return db.select({ id: professionals.id, displayName: professionals.displayName, status: professionals.status }).from(professionals).where(eq(professionals.ownerUserId, actor.userId)).orderBy(asc(professionals.displayName));
}
