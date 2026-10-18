import { and, eq } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { billingCustomers, billingEvents, plans, subscriptions, users } from "@/db/schema";
import { logger } from "@/lib/logger";
import { eventObject, isHandledEventType, readInvoiceSubscriptionId, readMetadata, readRef, readString, readSubscription, type JsonObject } from "@/modules/billing/domain/billing-events";
import { mapStripeStatus, unixToDate } from "@/modules/billing/domain/subscription-status";
import { notify } from "@/modules/notifications/application/notification-service";
import { reconcileAgencyHolds } from "@/modules/billing/application/agency-holds";
import { recordAudit } from "@/modules/admin/application/audit";

export type BillingProvider = "stripe" | "mock";

export type IngestInput = {
  provider: BillingProvider;
  externalEventId: string;
  type: string;
  payload: JsonObject;
};

export type IngestResult = { outcome: "processed" | "duplicate" | "ignored" | "failed"; error?: string };

/**
 * Idempotent ledger + transactional processing. The same function handles
 * Stripe webhooks and mock events, so the mock path exercises exactly the code
 * that production will run.
 *
 * Replays: an event id already processed is acknowledged without side effects.
 * An event recorded but whose processing failed is retried on the next delivery.
 */
export async function ingestBillingEvent(input: IngestInput): Promise<IngestResult> {
  const inserted = await db
    .insert(billingEvents)
    .values({ provider: input.provider, externalEventId: input.externalEventId, type: input.type, payload: input.payload })
    .onConflictDoNothing({ target: [billingEvents.provider, billingEvents.externalEventId] })
    .returning({ id: billingEvents.id });
  let ledgerId = inserted[0]?.id;
  if (!ledgerId) {
    const [existing] = await db
      .select({ id: billingEvents.id, processedAt: billingEvents.processedAt })
      .from(billingEvents)
      .where(and(eq(billingEvents.provider, input.provider), eq(billingEvents.externalEventId, input.externalEventId)))
      .limit(1);
    if (!existing) return { outcome: "failed", error: "ledger race" };
    if (existing.processedAt) return { outcome: "duplicate" };
    ledgerId = existing.id;
  }

  if (!isHandledEventType(input.type)) {
    await db.update(billingEvents).set({ processedAt: new Date() }).where(eq(billingEvents.id, ledgerId));
    return { outcome: "ignored" };
  }

  try {
    await db.transaction(async (tx) => {
      await applyEvent(tx, input);
    });
    await db.update(billingEvents).set({ processedAt: new Date(), error: null }).where(eq(billingEvents.id, ledgerId));
    return { outcome: "processed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, type: input.type, eventId: input.externalEventId }, "billing event processing failed");
    await db.update(billingEvents).set({ error: message.slice(0, 500) }).where(eq(billingEvents.id, ledgerId));
    return { outcome: "failed", error: message };
  }
}

async function applyEvent(tx: DbExecutor, input: IngestInput): Promise<void> {
  const obj = eventObject(input.payload);
  switch (input.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(tx, input.provider, obj);
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return upsertSubscriptionFromObject(tx, input.provider, obj);
    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(tx, input.provider, obj);
    case "invoice.paid":
      return handleInvoicePaid(tx, obj);
    case "invoice.payment_failed":
      return handlePaymentFailed(tx, obj);
    case "customer.subscription.trial_will_end":
      return handleTrialWillEnd(tx, obj);
    default:
      return;
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(tx: DbExecutor, provider: BillingProvider, session: JsonObject): Promise<void> {
  if (readString(session, "mode") !== "subscription") return;
  const meta = readMetadata(session);
  const userId = meta.userId ?? readString(session, "client_reference_id");
  if (!userId) throw new Error("checkout.session.completed without userId");
  const customerId = readRef(session, "customer");
  const subscriptionId = readRef(session, "subscription");
  if (customerId) await linkCustomer(tx, userId, customerId);
  if (!subscriptionId) return;
  const [existing] = await tx.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subscriptionId)).limit(1);
  if (existing) return; // the subscription.created event already arrived (ordering is not guaranteed)
  const plan = await resolvePlan(tx, null, meta.planKey ?? null);
  if (!plan) throw new Error("checkout.session.completed: plan not resolvable");
  await tx.insert(subscriptions).values({
    userId,
    professionalId: meta.professionalId || null,
    organizationId: meta.organizationId || null,
    quantity: positiveInt(meta.quantity) ?? 1,
    planId: plan.id,
    status: "incomplete",
    stripeSubscriptionId: subscriptionId,
    provider,
  });
}

async function upsertSubscriptionFromObject(tx: DbExecutor, provider: BillingProvider, obj: JsonObject): Promise<void> {
  const snap = readSubscription(obj);
  if (!snap.id) throw new Error("subscription event without id");
  const status = mapStripeStatus(snap.status);
  const [existing] = await tx
    .select({ id: subscriptions.id, userId: subscriptions.userId, planId: subscriptions.planId, status: subscriptions.status, organizationId: subscriptions.organizationId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, snap.id))
    .limit(1);

  const plan = await resolvePlan(tx, snap.priceId, snap.metadata.planKey ?? null);
  const periodPatch = {
    status,
    currentPeriodStart: unixToDate(snap.currentPeriodStart),
    currentPeriodEnd: unixToDate(snap.currentPeriodEnd),
    cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
    canceledAt: unixToDate(snap.canceledAt),
    endedAt: unixToDate(snap.endedAt),
    ...(snap.quantity !== null ? { quantity: snap.quantity } : {}),
  };

  if (existing) {
    await tx
      .update(subscriptions)
      .set({ ...periodPatch, ...(plan ? { planId: plan.id } : {}), ...(!existing.organizationId && snap.metadata.organizationId ? { organizationId: snap.metadata.organizationId } : {}) })
      .where(eq(subscriptions.id, existing.id));
    if (existing.status !== status) await notifyStatusChange(tx, existing.userId, status, snap.cancelAtPeriodEnd);
    const orgId = existing.organizationId ?? snap.metadata.organizationId ?? null;
    if (orgId) await reconcileAgencyHolds(orgId, tx);
    return;
  }

  const userId = snap.metadata.userId ?? (snap.customerId ? await userIdForCustomer(tx, snap.customerId) : null);
  if (!userId) throw new Error("subscription event: user not resolvable");
  if (!plan) throw new Error("subscription event: plan not resolvable");
  if (snap.customerId) await linkCustomer(tx, userId, snap.customerId);
  await tx.insert(subscriptions).values({
    userId,
    professionalId: snap.metadata.professionalId || null,
    organizationId: snap.metadata.organizationId || null,
    planId: plan.id,
    stripeSubscriptionId: snap.id,
    provider,
    ...periodPatch,
  });
  await notifyStatusChange(tx, userId, status, snap.cancelAtPeriodEnd);
  if (snap.metadata.organizationId) await reconcileAgencyHolds(snap.metadata.organizationId, tx);
}

async function handleSubscriptionDeleted(tx: DbExecutor, provider: BillingProvider, obj: JsonObject): Promise<void> {
  const snap = readSubscription(obj);
  if (!snap.id) throw new Error("subscription.deleted without id");
  const now = new Date();
  const [existing] = await tx.select({ id: subscriptions.id, userId: subscriptions.userId, organizationId: subscriptions.organizationId }).from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, snap.id)).limit(1);
  if (!existing) {
    // Deletion of something we never saw: nothing to revoke, but keep a trace.
    logger.warn({ provider, subscriptionId: snap.id }, "subscription.deleted for unknown subscription");
    return;
  }
  await tx
    .update(subscriptions)
    .set({ status: "canceled", canceledAt: unixToDate(snap.canceledAt) ?? now, endedAt: unixToDate(snap.endedAt) ?? now, cancelAtPeriodEnd: false })
    .where(eq(subscriptions.id, existing.id));
  await recordAudit(tx, { actorUserId: null, action: "billing.subscription.ended", resourceType: "subscription", resourceId: existing.id, metadata: { provider } });
  if (existing.organizationId) await reconcileAgencyHolds(existing.organizationId, tx);
  await notify(
    { userId: existing.userId, type: "payment_alert", title: "Votre abonnement est terminé", body: "Les fonctionnalités Premium sont désactivées. Vos données restent conservées selon notre politique.", href: "/app/compte/abonnement", dedupeKey: `sub-ended:${existing.id}` },
    tx,
  );
}

async function handleInvoicePaid(tx: DbExecutor, invoice: JsonObject): Promise<void> {
  const subId = readInvoiceSubscriptionId(invoice);
  if (!subId) return;
  const [sub] = await tx.select({ id: subscriptions.id, status: subscriptions.status, organizationId: subscriptions.organizationId }).from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subId)).limit(1);
  if (!sub) return;
  // A paid invoice after a failed attempt restores access; the subscription.updated event carries the new period.
  if (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "incomplete") {
    await tx.update(subscriptions).set({ status: "active" }).where(eq(subscriptions.id, sub.id));
  }
  if (sub.organizationId) await reconcileAgencyHolds(sub.organizationId, tx);
}

async function handlePaymentFailed(tx: DbExecutor, invoice: JsonObject): Promise<void> {
  const subId = readInvoiceSubscriptionId(invoice);
  if (!subId) return;
  const [sub] = await tx.select({ id: subscriptions.id, userId: subscriptions.userId, status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subId)).limit(1);
  if (!sub) return;
  if (sub.status === "active" || sub.status === "trialing") {
    await tx.update(subscriptions).set({ status: "past_due" }).where(eq(subscriptions.id, sub.id));
  }
  await notify(
    {
      userId: sub.userId,
      type: "payment_alert",
      title: "Échec du paiement de votre abonnement",
      body: "Le prélèvement n'a pas abouti. Mettez à jour votre moyen de paiement pour conserver vos fonctionnalités Premium ; l'accès est maintenu jusqu'à la fin de la période déjà réglée.",
      href: "/app/compte/abonnement",
      dedupeKey: `payment-failed:${sub.id}`,
      email: "always",
    },
    tx,
  );
}

async function handleTrialWillEnd(tx: DbExecutor, obj: JsonObject): Promise<void> {
  const snap = readSubscription(obj);
  if (!snap.id) return;
  const [sub] = await tx.select({ id: subscriptions.id, userId: subscriptions.userId }).from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, snap.id)).limit(1);
  if (!sub) return;
  await notify({ userId: sub.userId, type: "payment_alert", title: "Votre période d'essai se termine bientôt", body: "Votre abonnement sera facturé à la fin de l'essai. Vous pouvez l'annuler à tout moment depuis votre compte.", href: "/app/compte/abonnement", dedupeKey: `trial-end:${sub.id}` }, tx);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function positiveInt(v: string | undefined): number | null {
  const n = v ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function linkCustomer(tx: DbExecutor, userId: string, stripeCustomerId: string): Promise<void> {
  const [u] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  await tx
    .insert(billingCustomers)
    .values({ userId, stripeCustomerId, email: u?.email ?? null })
    .onConflictDoUpdate({ target: billingCustomers.userId, set: { stripeCustomerId } });
}

async function userIdForCustomer(tx: DbExecutor, stripeCustomerId: string): Promise<string | null> {
  const [c] = await tx.select({ userId: billingCustomers.userId }).from(billingCustomers).where(eq(billingCustomers.stripeCustomerId, stripeCustomerId)).limit(1);
  return c?.userId ?? null;
}

async function resolvePlan(tx: DbExecutor, priceId: string | null, planKey: string | null): Promise<{ id: string; key: string } | null> {
  if (priceId) {
    const [byPrice] = await tx.select({ id: plans.id, key: plans.key }).from(plans).where(eq(plans.stripePriceId, priceId)).limit(1);
    if (byPrice) return byPrice;
  }
  if (planKey) {
    const [byKey] = await tx.select({ id: plans.id, key: plans.key }).from(plans).where(eq(plans.key, planKey)).limit(1);
    if (byKey) return byKey;
  }
  return null;
}

async function notifyStatusChange(tx: DbExecutor, userId: string, status: string, cancelAtPeriodEnd: boolean): Promise<void> {
  if (status === "active" || status === "trialing") {
    await notify(
      {
        userId,
        type: "payment_alert",
        title: cancelAtPeriodEnd ? "Résiliation enregistrée" : "Votre abonnement est actif",
        body: cancelAtPeriodEnd ? "Vos fonctionnalités restent disponibles jusqu'à la fin de la période en cours." : "Merci ! Les fonctionnalités de votre offre sont désormais disponibles.",
        href: "/app/compte/abonnement",
        dedupeKey: `sub-status:${userId}:${status}:${cancelAtPeriodEnd ? "cancel" : "ok"}`,
      },
      tx,
    );
  }
}
