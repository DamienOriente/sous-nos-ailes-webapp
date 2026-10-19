import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { organizations, planPriceTiers, plans, professionals, subscriptions } from "@/db/schema";
import { logger } from "@/lib/logger";
import { grantsAccess } from "@/modules/billing/domain/subscription-status";
import type { PriceTier } from "@/modules/billing/domain/tiered-pricing";
import { notify } from "@/modules/notifications/application/notification-service";
import { recordAudit } from "@/modules/admin/application/audit";
import { billableExtraListings, countsAgainstQuota, listingSlots, listingsToHold } from "@/modules/professionals/domain/listing-quota";

/** Key of the plan billing agency listings beyond the first one (graduated tiers). */
export const AGENCY_PLAN_KEY = "agency_listings";

export type AgencyPlan = typeof plans.$inferSelect & { tiers: PriceTier[] };

export async function loadAgencyPlan(executor: DbExecutor = db): Promise<AgencyPlan | null> {
  const [plan] = await executor.select().from(plans).where(and(eq(plans.key, AGENCY_PLAN_KEY), eq(plans.isActive, true))).limit(1);
  if (!plan) return null;
  const tiers = await executor.select({ upTo: planPriceTiers.upTo, unitAmountCents: planPriceTiers.unitAmountCents }).from(planPriceTiers).where(eq(planPriceTiers.planId, plan.id));
  return { ...plan, tiers };
}

export type AgencyListing = { id: string; displayName: string; status: string; publishedAt: Date | null; billingHoldAt: Date | null; ownerUserId: string };

export type AgencyState = {
  organization: typeof organizations.$inferSelect;
  isVerifiedAgency: boolean;
  listings: AgencyListing[];
  countedListings: number;
  /** Units the current listings require (listings in review or online, minus the included one). */
  billableExtra: number;
  /** Units actually paid by a subscription that still grants access. */
  paidExtra: number;
  slots: number;
  subscription: (typeof subscriptions.$inferSelect) | null;
  subscriptionGrantsAccess: boolean;
};

/** Everything needed to decide quota, holds and billing for one organisation. */
export async function getAgencyState(organizationId: string, executor: DbExecutor = db): Promise<AgencyState | null> {
  const [organization] = await executor.select().from(organizations).where(and(eq(organizations.id, organizationId), isNull(organizations.deletedAt))).limit(1);
  if (!organization) return null;
  const listings = await executor
    .select({ id: professionals.id, displayName: professionals.displayName, status: professionals.status, publishedAt: professionals.publishedAt, billingHoldAt: professionals.billingHoldAt, ownerUserId: professionals.ownerUserId })
    .from(professionals)
    .where(and(eq(professionals.organizationId, organizationId), isNull(professionals.deletedAt)))
    .orderBy(asc(professionals.createdAt));
  const subs = await executor
    .select({ s: subscriptions })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(and(eq(subscriptions.organizationId, organizationId), eq(plans.key, AGENCY_PLAN_KEY)))
    .orderBy(desc(subscriptions.createdAt));
  const live = subs.map((r) => r.s).find((s) => grantsAccess(s)) ?? null;
  const subscription = live ?? subs[0]?.s ?? null;
  const isVerifiedAgency = organization.agencyStatus === "verified";
  const paidExtra = live && isVerifiedAgency ? live.quantity : 0;
  const countedListings = listings.filter((l) => countsAgainstQuota(l.status)).length;
  return {
    organization,
    isVerifiedAgency,
    listings,
    countedListings,
    billableExtra: billableExtraListings(countedListings),
    paidExtra,
    slots: listingSlots({ isVerifiedAgency, paidExtra }),
    subscription,
    subscriptionGrantsAccess: Boolean(live),
  };
}

/**
 * Puts on hold the listings beyond the paid slots and releases the others. Content and
 * moderation status are untouched: a held listing simply disappears from public pages.
 * Idempotent; called by the webhook processor, the quantity sync and an hourly tick.
 */
export async function reconcileAgencyHolds(organizationId: string, executor: DbExecutor = db): Promise<{ held: string[]; released: string[] }> {
  const state = await getAgencyState(organizationId, executor);
  if (!state) return { held: [], released: [] };
  const toHold = new Set(listingsToHold(state.listings, state.slots, state.organization.primaryListingId));
  const newlyHeld = state.listings.filter((l) => toHold.has(l.id) && !l.billingHoldAt);
  const released = state.listings.filter((l) => !toHold.has(l.id) && l.billingHoldAt);
  const now = new Date();
  if (newlyHeld.length) await executor.update(professionals).set({ billingHoldAt: now }).where(inArray(professionals.id, newlyHeld.map((l) => l.id)));
  if (released.length) await executor.update(professionals).set({ billingHoldAt: null }).where(inArray(professionals.id, released.map((l) => l.id)));
  if (newlyHeld.length || released.length) {
    logger.info({ organizationId, held: newlyHeld.length, released: released.length }, "agency listing holds reconciled");
    await recordAudit(executor, { actorUserId: null, action: "billing.agency.holds", resourceType: "organization", resourceId: organizationId, metadata: { held: newlyHeld.map((l) => l.id), released: released.map((l) => l.id), slots: state.slots } });
  }
  if (newlyHeld.length) {
    await notify(
      {
        userId: state.organization.ownerUserId,
        type: "payment_alert",
        title: newlyHeld.length > 1 ? `${newlyHeld.length} fiches retirées de l'annuaire` : "Une fiche retirée de l'annuaire",
        body: `Votre abonnement agence ne couvre plus ${newlyHeld.map((l) => `« ${l.displayName} »`).join(", ")}. Les fiches sont conservées telles quelles et reviennent dès que l'abonnement est réglé.`,
        href: "/app/pro",
        dedupeKey: `agency-hold:${organizationId}:${newlyHeld.map((l) => l.id).sort().join(",")}`,
      },
      executor,
    );
  }
  if (released.length) {
    await notify({ userId: state.organization.ownerUserId, type: "payment_alert", title: "Vos fiches sont de nouveau visibles", body: "Votre abonnement agence est réglé : les fiches retirées sont de retour dans l'annuaire.", href: "/app/pro", dedupeKey: `agency-release:${organizationId}:${released.map((l) => l.id).sort().join(",")}` }, executor);
  }
  return { held: newlyHeld.map((l) => l.id), released: released.map((l) => l.id) };
}

/** Hourly safety net: past_due grace periods end without any event. */
export async function reconcileAllAgencyHolds(executor: DbExecutor = db): Promise<number> {
  const orgs = await executor
    .selectDistinct({ id: professionals.organizationId })
    .from(professionals)
    .where(and(isNull(professionals.deletedAt), inArray(professionals.status, ["pending_review", "changes_requested", "approved", "published", "suspended"])));
  let n = 0;
  for (const o of orgs) {
    if (!o.id) continue;
    const r = await reconcileAgencyHolds(o.id, executor);
    n += r.held.length + r.released.length;
  }
  return n;
}
