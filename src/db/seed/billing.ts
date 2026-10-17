import { and, eq } from "drizzle-orm";
import { billingCustomers, billingEvents, promoCodes, subscriptions } from "@/db/schema";
import type { SeedContext } from "./context";

/**
 * Demo subscriptions (provider "mock", never Stripe). Idempotent: one row per
 * (user, plan key, demo marker) looked up before insert.
 *  - camille, helene: professional_premium active
 *  - louis: organizer_plus active
 *  - paul: free (no row) → triggers the paywall in the premium e2e scenario
 *  - theo: a past, canceled professional_premium
 *  - promo BIENVENUE20, a few mock billing events for the ledger view
 */
export async function seed(ctx: SeedContext): Promise<void> {
  const { db, now } = ctx;
  const day = 86_400_000;

  const upsertCustomer = async (userKey: string) => {
    const userId = ctx.users[userKey];
    if (!userId) return;
    await db
      .insert(billingCustomers)
      .values({ userId, stripeCustomerId: `mock_cus_demo_${userKey}`, email: `${userKey}@sousnosailes.test` })
      .onConflictDoNothing();
  };

  type Sub = { userKey: string; planKey: string; professionalKey?: string; status: "active" | "canceled"; startedDaysAgo: number; cancelAtPeriodEnd?: boolean };
  const subs: Sub[] = [
    { userKey: "camille", planKey: "professional_premium", professionalKey: "camille", status: "active", startedDaysAgo: 40 },
    { userKey: "helene", planKey: "professional_premium", professionalKey: "helene", status: "active", startedDaysAgo: 12 },
    { userKey: "louis", planKey: "organizer_plus", status: "active", startedDaysAgo: 20 },
    { userKey: "theo", planKey: "professional_premium", professionalKey: "theo", status: "canceled", startedDaysAgo: 120 },
  ];

  for (const s of subs) {
    const userId = ctx.users[s.userKey];
    const planId = ctx.plans[s.planKey];
    if (!userId || !planId) continue;
    await upsertCustomer(s.userKey);
    const mockId = `mock_sub_demo_${s.userKey}_${s.planKey}`;
    const [existing] = await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, mockId)).limit(1);
    const started = new Date(now.getTime() - s.startedDaysAgo * day);
    // Monthly periods: the current one started at the last anniversary.
    const periodsElapsed = Math.floor(s.startedDaysAgo / 30);
    const currentPeriodStart = new Date(started.getTime() + periodsElapsed * 30 * day);
    const currentPeriodEnd = new Date(currentPeriodStart.getTime() + 30 * day);
    const values = {
      userId,
      professionalId: s.professionalKey ? ctx.professionals[s.professionalKey] ?? null : null,
      planId,
      status: s.status,
      stripeSubscriptionId: mockId,
      provider: "mock",
      currentPeriodStart: s.status === "canceled" ? new Date(now.getTime() - 60 * day) : currentPeriodStart,
      currentPeriodEnd: s.status === "canceled" ? new Date(now.getTime() - 30 * day) : currentPeriodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: s.status === "canceled" ? new Date(now.getTime() - 45 * day) : null,
      endedAt: s.status === "canceled" ? new Date(now.getTime() - 30 * day) : null,
      createdAt: started,
    };
    if (existing) await db.update(subscriptions).set(values).where(eq(subscriptions.id, existing.id));
    else await db.insert(subscriptions).values(values);

    // Ledger entries mirroring what the mock provider would have recorded.
    const events: Array<{ id: string; type: string; at: Date }> = [
      { id: `${mockId}_evt_checkout`, type: "checkout.session.completed", at: started },
      { id: `${mockId}_evt_created`, type: "customer.subscription.created", at: started },
      { id: `${mockId}_evt_invoice`, type: "invoice.paid", at: started },
    ];
    if (s.status === "canceled") events.push({ id: `${mockId}_evt_deleted`, type: "customer.subscription.deleted", at: values.endedAt as Date });
    for (const e of events) {
      await db
        .insert(billingEvents)
        .values({ provider: "mock", externalEventId: e.id, type: e.type, payload: { id: e.id, type: e.type, demo: true, data: { object: { id: mockId, metadata: { userId, planKey: s.planKey } } } }, processedAt: e.at, createdAt: e.at })
        .onConflictDoNothing();
    }
  }

  // Promo code (20 % for 3 months, 100 redemptions).
  const [promo] = await db.select({ id: promoCodes.id }).from(promoCodes).where(eq(promoCodes.code, "BIENVENUE20")).limit(1);
  if (!promo) {
    await db.insert(promoCodes).values({ code: "BIENVENUE20", description: "Offre de bienvenue : -20 % pendant 3 mois (démo)", percentOff: 20, durationMonths: 3, maxRedemptions: 100, validFrom: new Date(now.getTime() - 30 * day), validUntil: new Date(now.getTime() + 365 * day), isActive: true });
  }

  // Safety: paul must stay on the free plan for the e2e paywall scenario.
  const paul = ctx.users.paul;
  if (paul) {
    const stray = await db.select({ id: subscriptions.id, sid: subscriptions.stripeSubscriptionId }).from(subscriptions).where(and(eq(subscriptions.userId, paul), eq(subscriptions.provider, "mock")));
    for (const row of stray) if (row.sid && !row.sid.includes("demo")) await db.update(subscriptions).set({ status: "canceled", endedAt: now, canceledAt: now }).where(eq(subscriptions.id, row.id));
  }
}
