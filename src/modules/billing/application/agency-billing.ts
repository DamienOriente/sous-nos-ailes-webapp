import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { organizations, subscriptions } from "@/db/schema";
import { env } from "@/lib/env";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Actor } from "@/lib/session";
import { amountForQuantity } from "@/modules/billing/domain/tiered-pricing";
import { getStripe } from "@/modules/billing/infrastructure/stripe-client";
import { AGENCY_PLAN_KEY, getAgencyState, loadAgencyPlan, reconcileAgencyHolds, type AgencyPlan } from "@/modules/billing/application/agency-holds";
import { ensureStripeCustomer, ensureStripePrice } from "@/modules/billing/application/subscription-service";
import { ingestBillingEvent } from "@/modules/billing/application/webhook-processor";
import { recordAudit } from "@/modules/admin/application/audit";

/**
 * Agency subscription: one subscription per organisation, quantity = listings beyond the
 * first one, graduated tiers. The agency never types a quantity: it follows the listings
 * in review or online (`syncAgencyQuantity`).
 */
export type AgencyCheckoutInput = { organizationId: string; quantity: number; professionalId?: string | null };

async function requireOwnedVerifiedAgency(actor: Actor, organizationId: string, executor: DbExecutor) {
  const [org] = await executor
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, organizationId), eq(organizations.ownerUserId, actor.userId), isNull(organizations.deletedAt)))
    .limit(1);
  if (!org) throw new NotFoundError();
  if (org.agencyStatus !== "verified") throw new ConflictError("Votre structure doit être validée comme agence avant d'ajouter des fiches.");
  return org;
}

async function requireAgencyPlan(executor: DbExecutor): Promise<AgencyPlan> {
  const plan = await loadAgencyPlan(executor);
  if (!plan || plan.tiers.length === 0) throw new NotFoundError("L'offre agence n'est pas disponible pour le moment.");
  return plan;
}

function checkQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) throw new ValidationError("Nombre de fiches invalide.");
  return quantity;
}

/** After payment: back to the listing's "add to subscription" page, which then sends it to review. */
export function agencyReturnPath(professionalId?: string | null): string {
  return professionalId ? `/app/pro/${professionalId}/ajout-agence?paye=1` : "/app/pro?paiement=agence";
}

export async function startAgencyCheckout(actor: Actor, input: AgencyCheckoutInput, executor: DbExecutor = db): Promise<{ provider: "stripe" | "mock"; url: string }> {
  const org = await requireOwnedVerifiedAgency(actor, input.organizationId, executor);
  const quantity = checkQuantity(input.quantity);
  const plan = await requireAgencyPlan(executor);
  const state = await getAgencyState(org.id, executor);
  if (state?.subscriptionGrantsAccess) throw new ConflictError("Votre abonnement agence est déjà actif : la fiche s'y ajoute directement.");

  const stripe = getStripe();
  if (!stripe) {
    const params = new URLSearchParams({ plan: plan.key, audience: "agency", organizationId: org.id, quantity: String(quantity) });
    if (input.professionalId) params.set("professionalId", input.professionalId);
    return { provider: "mock", url: `/app/compte/abonnement/mock-checkout?${params.toString()}` };
  }
  const customerId = await ensureStripeCustomer(stripe, actor, executor);
  const priceId = await ensureStripePrice(stripe, plan, executor, plan.tiers);
  const metadata = { userId: actor.userId, planKey: plan.key, organizationId: org.id, quantity: String(quantity), professionalId: input.professionalId ?? "" };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: actor.userId,
    line_items: [{ price: priceId, quantity }],
    success_url: `${env.APP_URL}${agencyReturnPath(input.professionalId)}`,
    cancel_url: `${env.APP_URL}/app/pro?checkout=cancelled`,
    locale: "fr",
    metadata,
    subscription_data: { metadata },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  await recordAudit(executor, { actorUserId: actor.userId, action: "billing.checkout.started", resourceType: "organization", resourceId: org.id, metadata: { provider: "stripe", planKey: plan.key, quantity } });
  return { provider: "stripe", url: session.url };
}

/** Mock provider: same events Stripe would send, through the same idempotent processor. */
export async function completeMockAgencyCheckout(actor: Actor, input: AgencyCheckoutInput & { outcome: "success" | "failure" }, executor: DbExecutor = db): Promise<{ subscriptionId: string | null }> {
  if (getStripe()) throw new ConflictError("Le paiement simulé est désactivé quand Stripe est configuré.");
  const org = await requireOwnedVerifiedAgency(actor, input.organizationId, executor);
  const quantity = checkQuantity(input.quantity);
  const plan = await requireAgencyPlan(executor);
  const stamp = Date.now();
  const nonce = Math.random().toString(36).slice(2, 10);
  const metadata = { userId: actor.userId, planKey: plan.key, organizationId: org.id, quantity: String(quantity), professionalId: input.professionalId ?? "" };
  if (input.outcome === "failure") {
    const id = `mock_evt_${stamp}_${nonce}_failed`;
    await ingestBillingEvent({ provider: "mock", externalEventId: id, type: "checkout.session.expired", payload: { id, type: "checkout.session.expired", data: { object: { id: `mock_cs_${nonce}`, mode: "subscription", status: "expired", metadata } } } });
    return { subscriptionId: null };
  }
  const subId = `mock_sub_${stamp}_${nonce}`;
  const customerId = `mock_cus_${actor.userId.slice(0, 12)}`;
  const nowSec = Math.floor(stamp / 1000);
  const subscriptionObject = {
    id: subId,
    object: "subscription",
    customer: customerId,
    status: "active",
    cancel_at_period_end: false,
    canceled_at: null,
    ended_at: null,
    metadata,
    items: { data: [{ id: `mock_si_${nonce}`, quantity, price: { id: plan.stripePriceId ?? `mock_price_${plan.key}`, currency: "eur" }, current_period_start: nowSec, current_period_end: nowSec + 30 * 24 * 3600 }] },
  };
  const checkoutId = `mock_evt_${stamp}_${nonce}_checkout`;
  await ingestBillingEvent({ provider: "mock", externalEventId: checkoutId, type: "checkout.session.completed", payload: { id: checkoutId, type: "checkout.session.completed", data: { object: { id: `mock_cs_${nonce}`, mode: "subscription", status: "complete", payment_status: "paid", customer: customerId, subscription: subId, client_reference_id: actor.userId, metadata } } } });
  const createdId = `mock_evt_${stamp}_${nonce}_sub`;
  await ingestBillingEvent({ provider: "mock", externalEventId: createdId, type: "customer.subscription.created", payload: { id: createdId, type: "customer.subscription.created", data: { object: subscriptionObject } } });
  const [row] = await executor.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subId)).limit(1);
  await recordAudit(executor, { actorUserId: actor.userId, action: "billing.checkout.completed", resourceType: "organization", resourceId: org.id, metadata: { provider: "mock", planKey: plan.key, quantity, amountCents: amountForQuantity(plan.tiers, quantity) } });
  return { subscriptionId: row?.id ?? null };
}

/**
 * Aligns the billed quantity on the listings that need a slot, then reconciles holds.
 * Called after a submission, an archive, a refusal, a status loss. Runs outside the
 * caller's transaction: if the provider call fails, the listing beyond the paid slots is
 * simply held (never shown unpaid) and the next sync retries.
 */
export async function syncAgencyQuantity(organizationId: string): Promise<{ quantity: number | null }> {
  const state = await getAgencyState(organizationId);
  if (!state) return { quantity: null };
  const sub = state.subscriptionGrantsAccess ? state.subscription : null;
  if (sub && sub.quantity !== state.billableExtra) {
    const quantity = state.billableExtra;
    try {
      const stripe = getStripe();
      if (sub.provider === "stripe" && stripe && sub.stripeSubscriptionId) {
        const remote = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        const item = remote.items.data[0];
        if (!item) throw new Error("agency subscription without item");
        await stripe.subscriptions.update(sub.stripeSubscriptionId, { items: [{ id: item.id, quantity }], proration_behavior: "create_prorations" });
        await db.update(subscriptions).set({ quantity }).where(eq(subscriptions.id, sub.id));
      } else {
        const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const id = `mock_evt_${nonce}_qty`;
        const toSec = (d: Date | null) => (d ? Math.floor(d.getTime() / 1000) : null);
        await ingestBillingEvent({
          provider: "mock",
          externalEventId: id,
          type: "customer.subscription.updated",
          payload: {
            id,
            type: "customer.subscription.updated",
            data: {
              object: {
                id: sub.stripeSubscriptionId,
                object: "subscription",
                status: sub.status,
                cancel_at_period_end: sub.cancelAtPeriodEnd,
                metadata: { userId: sub.userId, planKey: AGENCY_PLAN_KEY, organizationId },
                items: { data: [{ id: `mock_si_${sub.id.slice(0, 8)}`, quantity, current_period_start: toSec(sub.currentPeriodStart), current_period_end: toSec(sub.currentPeriodEnd) }] },
              },
            },
          },
        });
      }
      await recordAudit(db, { actorUserId: null, action: "billing.agency.quantity", resourceType: "organization", resourceId: organizationId, metadata: { from: sub.quantity, to: quantity, provider: sub.provider } });
    } catch (err) {
      logger.error({ err: (err as Error).message, organizationId }, "agency quantity sync failed");
    }
  }
  await reconcileAgencyHolds(organizationId);
  const after = await getAgencyState(organizationId);
  return { quantity: after?.subscriptionGrantsAccess ? (after.subscription?.quantity ?? null) : null };
}

/**
 * Hourly safety net: aligns every agency's quantity (moderation refusals, failed provider
 * calls) and applies holds when a past_due grace period ends without any event.
 */
export async function syncAllAgencies(): Promise<number> {
  const rows = await db.select({ id: organizations.id }).from(organizations).where(and(isNull(organizations.deletedAt), inArray(organizations.agencyStatus, ["verified", "rejected", "pending"])));
  for (const r of rows) await syncAgencyQuantity(r.id);
  return rows.length;
}
