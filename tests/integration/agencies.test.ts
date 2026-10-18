/**
 * One listing per independent, several for a verified agency, extra listings billed with
 * graduated tiers, and listings held from the public when the agency subscription stops.
 * Mock provider (no Stripe key) except the last block, which checks the tiered Stripe Price.
 */
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import "./setup";

const stripeState = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/modules/billing/infrastructure/stripe-client", () => ({
  getStripe: () => stripeState.client,
  getStripeWebhookSecret: () => "whsec_itest_agencies",
  stripeWebhooks: () => null,
}));

import { db } from "@/db/client";
import { auditLogs, billingEvents, moderationCases, moderationDecisions, notifications, organizationMembers, organizations, plans, professionalCategories, professionals, subscriptions, users } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { completeMockAgencyCheckout, startAgencyCheckout, syncAgencyQuantity } from "@/modules/billing/application/agency-billing";
import { AGENCY_PLAN_KEY, getAgencyState, loadAgencyPlan } from "@/modules/billing/application/agency-holds";
import { ensureStripePrice } from "@/modules/billing/application/subscription-service";
import { simulateMockPeriodEnd } from "@/modules/billing/application/subscription-service";
import { searchDirectory } from "@/modules/directory/application/directory-search";
import { parseSearchParams } from "@/modules/directory/domain/search-params";
import { decideCase } from "@/modules/moderation/application/moderation-service";
import { existingIndependentListingId, requestAgencyStatus } from "@/modules/professionals/application/agency-service";
import { agencyPaymentDetails, assertListingSlot, ListingLimitError } from "@/modules/professionals/application/listing-slot";
import { createDraft } from "@/modules/professionals/application/professional-service";

const RUN = "itest-agency";
const mk = (k: string, role: Actor["globalRole"] = "user"): Actor => ({ userId: `${RUN}-${k}`, email: `${RUN}-${k}@sousnosailes.test`, name: `Itest ${k}`, globalRole: role, emailVerified: true, isDemo: false });
const INDEP = mk("indep");
const RACE = mk("race");
const AGENCY = mk("owner");
const MOD = mk("mod", "moderator");
const ACTORS = [INDEP, RACE, AGENCY, MOD];
const IDS = ACTORS.map((a) => a.userId);

let categoryId: string;
let orgId: string;

async function cleanup() {
  const orgs = await db.select({ id: organizations.id }).from(organizations).where(inArray(organizations.ownerUserId, IDS));
  const orgIds = orgs.map((o) => o.id);
  const pros = await db.select({ id: professionals.id }).from(professionals).where(inArray(professionals.ownerUserId, IDS));
  if (orgIds.length) {
    const cases = await db.select({ id: moderationCases.id }).from(moderationCases).where(inArray(moderationCases.resourceId, orgIds));
    if (cases.length) await db.delete(moderationDecisions).where(inArray(moderationDecisions.caseId, cases.map((c) => c.id)));
    await db.delete(moderationCases).where(inArray(moderationCases.resourceId, orgIds));
  }
  await db.delete(subscriptions).where(inArray(subscriptions.userId, IDS));
  if (pros.length) await db.delete(professionals).where(inArray(professionals.id, pros.map((p) => p.id)));
  await db.delete(organizationMembers).where(inArray(organizationMembers.userId, IDS));
  if (orgIds.length) await db.delete(organizations).where(inArray(organizations.id, orgIds));
  await db.delete(billingEvents).where(like(billingEvents.externalEventId, "mock_evt_%"));
  await db.delete(notifications).where(inArray(notifications.userId, IDS));
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, IDS));
  await db.delete(users).where(inArray(users.id, IDS));
}

/** Inserts a listing directly in a given state (the onboarding steps are covered elsewhere). */
async function listing(owner: Actor, slug: string, status: "draft" | "pending_review" | "published", publishedDaysAgo = 0) {
  const [row] = await db
    .insert(professionals)
    .values({ ownerUserId: owner.userId, organizationId: orgId, slug: `${RUN}-${slug}`, displayName: `Itest ${slug}`, primaryCategoryId: categoryId, status, city: "Lyon", postalCode: "69002", department: "69", publishedAt: status === "published" ? new Date(Date.now() - publishedDaysAgo * 86_400_000) : null })
    .returning();
  return row!;
}

async function paymentDetails(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return agencyPaymentDetails(e);
  }
  return null;
}

beforeAll(async () => {
  await cleanup();
  for (const a of ACTORS) await db.insert(users).values({ id: a.userId, name: a.name, email: a.email, emailVerified: true, role: a.globalRole });
  const [cat] = await db.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, "decorateur")).limit(1);
  if (!cat) throw new Error("reference data missing: run pnpm db:seed first");
  categoryId = cat.id;
  if (!(await loadAgencyPlan())) throw new Error("agency plan missing: run pnpm db:seed first");
});
afterAll(cleanup);

describe("independents run a single listing", () => {
  it("refuses a second draft and points to the existing one", async () => {
    const { id } = await createDraft(INDEP, { primaryCategoryId: categoryId, secondaryCategoryIds: [] });
    const err = await createDraft(INDEP, { primaryCategoryId: categoryId, secondaryCategoryIds: [] }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ListingLimitError);
    expect((err as ListingLimitError).existingListingId).toBe(id);
    expect(await existingIndependentListingId(INDEP.userId)).toBe(id);
  });

  it("is race-free: two simultaneous creations give one listing", async () => {
    const results = await Promise.allSettled([0, 1, 2].map(() => createDraft(RACE, { primaryCategoryId: categoryId, secondaryCategoryIds: [] })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rows = await db.select({ id: professionals.id }).from(professionals).where(eq(professionals.ownerUserId, RACE.userId));
    expect(rows).toHaveLength(1);
  });
});

describe("agency status", () => {
  it("a pending request does not unlock a second listing; approval does", async () => {
    const { id: first } = await createDraft(AGENCY, { primaryCategoryId: categoryId, secondaryCategoryIds: [] });
    ({ organizationId: orgId } = await requestAgencyStatus(AGENCY, { name: "Itest Agence", type: "company", siret: "99900001000010", addressLine1: "1 rue Test", postalCode: "69002", city: "Lyon" }));
    const [attached] = await db.select({ organizationId: professionals.organizationId }).from(professionals).where(eq(professionals.id, first));
    expect(attached?.organizationId).toBe(orgId);
    await expect(createDraft(AGENCY, { primaryCategoryId: categoryId, secondaryCategoryIds: [] })).rejects.toBeInstanceOf(ListingLimitError);

    const [c] = await db.select({ id: moderationCases.id }).from(moderationCases).where(and(eq(moderationCases.kind, "agency_review"), eq(moderationCases.resourceId, orgId)));
    expect(c).toBeTruthy();
    await decideCase(MOD, c!.id, { decision: "approve", reason: "SIRET vérifié, trois activités distinctes." });
    const [org] = await db.select({ status: organizations.agencyStatus }).from(organizations).where(eq(organizations.id, orgId));
    expect(org?.status).toBe("verified");
    const second = await createDraft(AGENCY, { primaryCategoryId: categoryId, secondaryCategoryIds: [] });
    const [row] = await db.select({ organizationId: professionals.organizationId }).from(professionals).where(eq(professionals.id, second.id));
    expect(row?.organizationId).toBe(orgId);
    // Drafts never occupy a slot: clean them for the billing scenario below.
    await db.delete(professionals).where(inArray(professionals.id, [first, second.id]));
  });
});

describe("agency billing with graduated tiers", () => {
  let a: string, b: string, c: string;

  it("the 2nd listing needs an agency subscription, priced at the first tier", async () => {
    a = (await listing(AGENCY, "a", "published", 30)).id;
    const draftB = await listing(AGENCY, "b", "draft");
    b = draftB.id;
    const details = await paymentDetails(assertListingSlot(draftB, {}));
    expect(details).toMatchObject({ reason: "agency_subscription_required", quantity: 1, monthlyCents: 1490, addedCents: 1490 });
    const res = await startAgencyCheckout(AGENCY, { organizationId: orgId, quantity: 1, professionalId: b });
    expect(res.provider).toBe("mock");
    expect(res.url).toContain("audience=agency");
    await completeMockAgencyCheckout(AGENCY, { organizationId: orgId, quantity: 1, professionalId: b, outcome: "success" });
    await expect(assertListingSlot(draftB, {})).resolves.toBeUndefined();
    await db.update(professionals).set({ status: "published", publishedAt: new Date(Date.now() - 10 * 86_400_000) }).where(eq(professionals.id, b));
    expect((await syncAgencyQuantity(orgId)).quantity).toBe(1);
  });

  it("the 3rd listing asks for confirmation, then the quantity follows the listings", async () => {
    const draftC = await listing(AGENCY, "c", "draft");
    c = draftC.id;
    const details = await paymentDetails(assertListingSlot(draftC, {}));
    expect(details).toMatchObject({ reason: "agency_extra_confirmation", quantity: 2, monthlyCents: 2980, addedCents: 1490 });
    await expect(assertListingSlot(draftC, { confirmExtraCharge: true })).resolves.toBeUndefined();
    await db.update(professionals).set({ status: "pending_review" }).where(eq(professionals.id, c));
    expect((await syncAgencyQuantity(orgId)).quantity).toBe(2);
    const fourth = await listing(AGENCY, "d", "draft");
    expect(await paymentDetails(assertListingSlot(fourth, {}))).toMatchObject({ quantity: 3, monthlyCents: 2980 + 990, addedCents: 990 });
    await db.delete(professionals).where(eq(professionals.id, fourth.id));
  });

  it("archiving a listing lowers the quantity", async () => {
    await db.update(professionals).set({ status: "archived", deletedAt: new Date() }).where(eq(professionals.id, c));
    expect((await syncAgencyQuantity(orgId)).quantity).toBe(1);
  });

  it("when the subscription ends, extra listings leave the directory and come back after payment", async () => {
    const state = await getAgencyState(orgId);
    await simulateMockPeriodEnd(AGENCY, state!.subscription!.id);
    const after = await getAgencyState(orgId);
    expect(after?.slots).toBe(1);
    const rows = await db.select({ id: professionals.id, held: professionals.billingHoldAt }).from(professionals).where(inArray(professionals.id, [a, b]));
    expect(rows.find((r) => r.id === a)?.held).toBeNull(); // oldest published stays
    expect(rows.find((r) => r.id === b)?.held).not.toBeNull();
    const search = await searchDirectory(parseSearchParams({ q: "Itest" }), null);
    const slugs = search.items.map((i) => i.slug);
    expect(slugs).toContain(`${RUN}-a`);
    expect(slugs).not.toContain(`${RUN}-b`);
    const [n] = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, AGENCY.userId), like(notifications.title, "%retirée%")));
    expect(n).toBeTruthy();

    await completeMockAgencyCheckout(AGENCY, { organizationId: orgId, quantity: 1, outcome: "success" });
    const [back] = await db.select({ held: professionals.billingHoldAt }).from(professionals).where(eq(professionals.id, b));
    expect(back?.held).toBeNull();
  });

  it("a refused agency keeps a single visible listing", async () => {
    const [c2] = await db.select({ id: moderationCases.id }).from(moderationCases).where(and(eq(moderationCases.kind, "agency_review"), eq(moderationCases.resourceId, orgId)));
    await db.update(organizations).set({ agencyStatus: "pending" }).where(eq(organizations.id, orgId));
    await db.update(moderationCases).set({ status: "open", resolvedAt: null }).where(eq(moderationCases.id, c2!.id));
    await decideCase(MOD, c2!.id, { decision: "reject", reason: "Une seule activité réelle, pas de statut agence." });
    const held = await db.select({ id: professionals.id }).from(professionals).where(and(eq(professionals.organizationId, orgId), eq(professionals.status, "published")));
    const visible = (await db.select({ held: professionals.billingHoldAt }).from(professionals).where(inArray(professionals.id, held.map((h) => h.id)))).filter((r) => !r.held);
    expect(visible).toHaveLength(1);
  });
});

describe("Stripe: graduated tiered price", () => {
  it("creates a tiered Price with the configured tiers", async () => {
    const created: unknown[] = [];
    const fake = {
      products: { create: vi.fn(async () => ({ id: "prod_itest" })) },
      prices: { create: vi.fn(async (p: unknown) => (created.push(p), { id: "price_itest_tiers" })) },
    };
    const plan = await loadAgencyPlan();
    const [row] = await db.select().from(plans).where(eq(plans.key, AGENCY_PLAN_KEY));
    const snapshot = { stripePriceId: row!.stripePriceId, stripeProductId: row!.stripeProductId };
    try {
      await db.update(plans).set({ stripePriceId: null, stripeProductId: null }).where(eq(plans.id, row!.id));
      const id = await ensureStripePrice(fake as never, { ...row!, stripePriceId: null, stripeProductId: null }, db, plan!.tiers);
      expect(id).toBe("price_itest_tiers");
      expect(created[0]).toMatchObject({ billing_scheme: "tiered", tiers_mode: "graduated", tiers: [{ up_to: 2, unit_amount: 1490 }, { up_to: 9, unit_amount: 990 }, { up_to: "inf", unit_amount: 690 }] });
    } finally {
      await db.update(plans).set(snapshot).where(eq(plans.id, row!.id));
    }
  });

  it("agency errors are recognisable application errors", () => {
    expect(isAppError(new ListingLimitError("x"))).toBe(true);
  });
});
