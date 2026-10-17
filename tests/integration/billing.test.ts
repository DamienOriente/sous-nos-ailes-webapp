/**
 * Scenario C — premium tool → 402 → subscription → webhooks → entitlement →
 * cancel at period end → access kept → deleted → access removed. Runs twice:
 * once in mock mode (no Stripe client), once with a mocked Stripe SDK where the
 * webhook signature is computed with `generateTestHeaderString`.
 */
import Stripe from "stripe";
import { and, eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import "./setup";

const stripeState = vi.hoisted(() => ({ client: null as unknown, secret: "whsec_itest_secret" }));

vi.mock("@/modules/billing/infrastructure/stripe-client", () => ({
  getStripe: () => stripeState.client,
  getStripeWebhookSecret: () => stripeState.secret,
  stripeWebhooks: () => new Stripe("sk_test_signature_only").webhooks,
}));

import { db } from "@/db/client";
import { auditLogs, billingCustomers, billingEvents, emailOutbox, notifications, plans, securityEvents, subscriptions, users } from "@/db/schema";
import { PaymentRequiredError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { hasFeature, requireFeature } from "@/modules/billing/application/entitlements";
import { cancelAtPeriodEnd, completeMockCheckout, resumeSubscription, simulateMockPeriodEnd, startCheckout } from "@/modules/billing/application/subscription-service";
import { ingestBillingEvent } from "@/modules/billing/application/webhook-processor";
import { POST as webhookPost } from "@/app/api/billing/webhooks/stripe/route";

const EMAIL = "itest-billing@sousnosailes.test";
const USER_ID = "itest-billing-user";
const actor: Actor = { userId: USER_ID, email: EMAIL, name: "Itest Billing", globalRole: "user", emailVerified: true, isDemo: false };
const realStripe = new Stripe("sk_test_signature_only");

async function cleanup() {
  await db.delete(subscriptions).where(eq(subscriptions.userId, USER_ID));
  await db.delete(billingCustomers).where(eq(billingCustomers.userId, USER_ID));
  await db.delete(billingEvents).where(like(billingEvents.externalEventId, "itest_%"));
  await db.delete(billingEvents).where(like(billingEvents.externalEventId, "mock_evt_%"));
  await db.delete(notifications).where(eq(notifications.userId, USER_ID));
  await db.delete(emailOutbox).where(eq(emailOutbox.toEmail, EMAIL));
  await db.delete(auditLogs).where(eq(auditLogs.actorUserId, USER_ID));
  await db.delete(securityEvents).where(like(securityEvents.type, "webhook_%"));
  await db.delete(users).where(eq(users.id, USER_ID));
}

beforeAll(async () => {
  await cleanup();
  await db.insert(users).values({ id: USER_ID, name: "Itest Billing", email: EMAIL, emailVerified: true, isDemo: false });
});
afterAll(cleanup);

describe("Scenario C in mock mode (no Stripe key)", () => {
  it("premium tool is denied with 402 on the free plan", async () => {
    stripeState.client = null;
    expect(await hasFeature(USER_ID, "organizer", "seating_plan")).toBe(false);
    await expect(requireFeature(actor, "organizer", "seating_plan")).rejects.toBeInstanceOf(PaymentRequiredError);
  });

  it("checkout → mock provider → events processed → feature granted", async () => {
    const res = await startCheckout(actor, { planKey: "organizer_plus", audience: "organizer", promoCode: "BIENVENUE20" });
    expect(res.provider).toBe("mock");
    expect(res.url).toContain("/app/compte/abonnement/mock-checkout?");
    const { subscriptionId } = await completeMockCheckout(actor, { planKey: "organizer_plus", audience: "organizer", outcome: "success" });
    expect(subscriptionId).toBeTruthy();
    expect(await hasFeature(USER_ID, "organizer", "seating_plan")).toBe(true);
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId as string));
    expect(sub?.status).toBe("active");
    expect(sub?.provider).toBe("mock");
    expect(sub?.currentPeriodEnd && sub.currentPeriodEnd > new Date()).toBe(true);
  });

  it("rejects a second checkout for the same plan", async () => {
    await expect(startCheckout(actor, { planKey: "organizer_plus", audience: "organizer" })).rejects.toThrow(/déjà abonné/);
  });

  it("cancel at period end keeps access until the period ends; resume works; deletion removes access", async () => {
    const [sub] = await db.select().from(subscriptions).where(and(eq(subscriptions.userId, USER_ID), eq(subscriptions.status, "active")));
    expect(sub).toBeTruthy();
    await cancelAtPeriodEnd(actor, sub!.id);
    const [after] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub!.id));
    expect(after?.cancelAtPeriodEnd).toBe(true);
    expect(after?.status).toBe("active");
    expect(await hasFeature(USER_ID, "organizer", "seating_plan")).toBe(true);
    await resumeSubscription(actor, sub!.id);
    const [resumed] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub!.id));
    expect(resumed?.cancelAtPeriodEnd).toBe(false);
    await cancelAtPeriodEnd(actor, sub!.id);
    await simulateMockPeriodEnd(actor, sub!.id);
    const [ended] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub!.id));
    expect(ended?.status).toBe("canceled");
    expect(ended?.endedAt).toBeTruthy();
    expect(await hasFeature(USER_ID, "organizer", "seating_plan")).toBe(false);
  });

  it("mock failure outcome creates nothing", async () => {
    const before = (await db.select().from(subscriptions).where(eq(subscriptions.userId, USER_ID))).length;
    const res = await completeMockCheckout(actor, { planKey: "organizer_plus", audience: "organizer", outcome: "failure" });
    expect(res.subscriptionId).toBeNull();
    expect((await db.select().from(subscriptions).where(eq(subscriptions.userId, USER_ID))).length).toBe(before);
    expect(await hasFeature(USER_ID, "organizer", "seating_plan")).toBe(false);
  });

  it("replayed events are acknowledged without side effects", async () => {
    const id = `itest_replay_${Date.now()}`;
    const payload = { id, type: "customer.subscription.trial_will_end", data: { object: { id: "sub_unknown" } } };
    const first = await ingestBillingEvent({ provider: "mock", externalEventId: id, type: payload.type, payload });
    const second = await ingestBillingEvent({ provider: "mock", externalEventId: id, type: payload.type, payload });
    expect(first.outcome).toBe("processed");
    expect(second.outcome).toBe("duplicate");
    const rows = await db.select().from(billingEvents).where(eq(billingEvents.externalEventId, id));
    expect(rows).toHaveLength(1);
  });
});

describe("Scenario C with the Stripe SDK mocked", () => {
  const fake = {
    customers: { create: vi.fn(async () => ({ id: "cus_itest" })) },
    products: { create: vi.fn(async () => ({ id: "prod_itest" })) },
    prices: { create: vi.fn(async () => ({ id: "price_itest_plus" })) },
    checkout: { sessions: { create: vi.fn(async (params: Record<string, unknown>) => ({ id: "cs_itest", url: "https://checkout.stripe.com/c/pay/cs_itest", ...params })) } },
    subscriptions: { update: vi.fn(async (id: string, params: Record<string, unknown>) => ({ id, ...params })) },
    billingPortal: { sessions: { create: vi.fn(async () => ({ url: "https://billing.stripe.com/p/session" })) } },
    invoices: { list: vi.fn(async () => ({ data: [] })) },
  };
  const subId = `sub_itest_${Date.now()}`;
  const nowSec = Math.floor(Date.now() / 1000);

  async function deliver(id: string, type: string, object: Record<string, unknown>) {
    const payload = JSON.stringify({ id, object: "event", type, created: nowSec, data: { object } });
    const header = realStripe.webhooks.generateTestHeaderString({ payload, secret: stripeState.secret });
    return webhookPost(new Request("http://localhost:3200/api/billing/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": header, "content-type": "application/json" } }));
  }

  beforeAll(async () => {
    stripeState.client = fake;
    // The mock provider linked a mock customer id; a real deployment never mixes providers.
    await db.delete(billingCustomers).where(eq(billingCustomers.userId, USER_ID));
    await db.update(plans).set({ stripePriceId: null, stripeProductId: null }).where(eq(plans.key, "organizer_plus"));
  });
  afterAll(async () => {
    stripeState.client = null;
    await db.update(plans).set({ stripePriceId: null, stripeProductId: null }).where(eq(plans.key, "organizer_plus"));
  });

  it("creates customer, product/price on the fly and a checkout session with metadata", async () => {
    const res = await startCheckout(actor, { planKey: "organizer_plus", audience: "organizer" });
    expect(res.provider).toBe("stripe");
    expect(res.url).toMatch(/^https:\/\/checkout\.stripe\.com/);
    expect(fake.customers.create).toHaveBeenCalledTimes(1);
    expect(fake.prices.create).toHaveBeenCalledTimes(1);
    const params = fake.checkout.sessions.create.mock.calls[0]?.[0] as { mode: string; metadata: Record<string, string>; success_url: string; line_items: Array<{ price: string }> };
    expect(params.mode).toBe("subscription");
    expect(params.metadata).toMatchObject({ userId: USER_ID, planKey: "organizer_plus" });
    expect(params.success_url).toContain("/app/compte/abonnement/retour?session_id={CHECKOUT_SESSION_ID}");
    expect(params.line_items[0]?.price).toBe("price_itest_plus");
    const [plan] = await db.select().from(plans).where(eq(plans.key, "organizer_plus"));
    expect(plan?.stripePriceId).toBe("price_itest_plus");
    const [cust] = await db.select().from(billingCustomers).where(eq(billingCustomers.userId, USER_ID));
    expect(cust?.stripeCustomerId).toBe("cus_itest");
    expect(await hasFeature(USER_ID, "organizer", "seating_plan")).toBe(false); // the redirect proves nothing
  });

  it("checkout.session.completed + customer.subscription.updated (signed) activate the entitlement", async () => {
    const r1 = await deliver(`itest_evt_cs_${subId}`, "checkout.session.completed", { id: "cs_itest", object: "checkout.session", mode: "subscription", customer: "cus_itest", subscription: subId, client_reference_id: USER_ID, metadata: { userId: USER_ID, planKey: "organizer_plus", professionalId: "" } });
    expect(r1.status).toBe(200);
    expect(await hasFeature(USER_ID, "organizer", "seating_plan")).toBe(false); // incomplete until the subscription object arrives
    const r2 = await deliver(`itest_evt_upd_${subId}`, "customer.subscription.updated", {
      id: subId,
      object: "subscription",
      customer: "cus_itest",
      status: "active",
      cancel_at_period_end: false,
      metadata: { userId: USER_ID, planKey: "organizer_plus", professionalId: "" },
      items: { data: [{ id: "si_1", price: { id: "price_itest_plus" }, current_period_start: nowSec, current_period_end: nowSec + 30 * 86_400 }] },
    });
    expect(r2.status).toBe(200);
    expect(await hasFeature(USER_ID, "organizer", "seating_plan")).toBe(true);
  });

  it("invoice.payment_failed → past_due + payment alert, access kept during the paid period", async () => {
    const r = await deliver(`itest_evt_inv_fail_${subId}`, "invoice.payment_failed", { id: "in_1", object: "invoice", parent: { subscription_details: { subscription: subId } } });
    expect(r.status).toBe(200);
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subId));
    expect(sub?.status).toBe("past_due");
    expect(await hasFeature(USER_ID, "organizer", "seating_plan")).toBe(true);
    const alerts = await db.select().from(notifications).where(and(eq(notifications.userId, USER_ID), eq(notifications.type, "payment_alert")));
    expect(alerts.some((a) => a.title.includes("Échec du paiement"))).toBe(true);
    const mails = await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, EMAIL));
    expect(mails.length).toBeGreaterThan(0);
    await deliver(`itest_evt_inv_paid_${subId}`, "invoice.paid", { id: "in_2", object: "invoice", parent: { subscription_details: { subscription: subId } } });
    const [restored] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subId));
    expect(restored?.status).toBe("active");
  });

  it("cancel at period end calls Stripe and keeps access until currentPeriodEnd", async () => {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subId));
    await cancelAtPeriodEnd(actor, sub!.id);
    expect(fake.subscriptions.update).toHaveBeenCalledWith(subId, { cancel_at_period_end: true });
    expect(await hasFeature(USER_ID, "organizer", "seating_plan")).toBe(true);
    const [after] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub!.id));
    expect(after?.cancelAtPeriodEnd).toBe(true);
    expect(after?.currentPeriodEnd && after.currentPeriodEnd > new Date()).toBe(true);
  });

  it("customer.subscription.deleted removes access; a replay is ignored; an invalid signature is rejected", async () => {
    const r = await deliver(`itest_evt_del_${subId}`, "customer.subscription.deleted", { id: subId, object: "subscription", status: "canceled", canceled_at: nowSec, ended_at: nowSec, metadata: { userId: USER_ID } });
    expect(r.status).toBe(200);
    expect(await hasFeature(USER_ID, "organizer", "seating_plan")).toBe(false);
    const replay = await deliver(`itest_evt_del_${subId}`, "customer.subscription.deleted", { id: subId, object: "subscription", status: "canceled" });
    expect(await replay.json()).toMatchObject({ outcome: "duplicate" });

    const payload = JSON.stringify({ id: "itest_evt_bad", type: "customer.subscription.deleted", data: { object: { id: subId } } });
    const bad = await webhookPost(new Request("http://localhost:3200/api/billing/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": "t=1,v1=deadbeef" } }));
    expect(bad.status).toBe(400);
    const events = await db.select().from(securityEvents).where(eq(securityEvents.type, "webhook_signature_invalid"));
    expect(events.length).toBeGreaterThan(0);
    const ledger = await db.select().from(billingEvents).where(eq(billingEvents.externalEventId, "itest_evt_bad"));
    expect(ledger).toHaveLength(0);
  });
});
