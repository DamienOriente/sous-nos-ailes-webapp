import { cache } from "react";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { organizationMembers, organizations, professionals } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { getAgencyState, loadAgencyPlan, reconcileAgencyHolds, type AgencyState } from "@/modules/billing/application/agency-holds";
import { amountForQuantity, nextUnitPrice, type PriceTier } from "@/modules/billing/domain/tiered-pricing";
import { openModerationCase } from "@/modules/moderation/application/moderation-service";
import { notify } from "@/modules/notifications/application/notification-service";
import { sirenFromSiret } from "@/modules/professionals/domain/siret";
import { resolveUniqueSlug } from "@/modules/professionals/domain/slug";
import type { AgencyRequestInput } from "@/modules/professionals/domain/agency-schema";
import { audit } from "./audit";

/**
 * One structure per account (2026-10-18): the organisation the user owns. It starts as a
 * plain identity holder (sole trader or company without agency status) and becomes an
 * agency once a moderator verifies it.
 */
export async function findOwnedOrganization(userId: string, executor: DbExecutor = db) {
  const rows = await executor
    .select()
    .from(organizations)
    .where(and(eq(organizations.ownerUserId, userId), isNull(organizations.deletedAt)))
    .orderBy(asc(organizations.createdAt));
  // Older data may hold one organisation per listing: the agency one wins, then the oldest.
  return rows.find((o) => o.agencyStatus !== "none") ?? rows[0] ?? null;
}

export type AccountStructure = {
  organization: Awaited<ReturnType<typeof findOwnedOrganization>>;
  isVerifiedAgency: boolean;
  state: AgencyState | null;
  tiers: PriceTier[];
  /** Price of the listing that would be added next (cents per month), agencies only. */
  nextListingCents: number | null;
  /** Current monthly amount for the paid extra listings. */
  monthlyCents: number;
};

export async function getAccountStructure(actor: Actor, executor: DbExecutor = db): Promise<AccountStructure> {
  const organization = await findOwnedOrganization(actor.userId, executor);
  const state = organization ? await getAgencyState(organization.id, executor) : null;
  const plan = await loadAgencyPlan(executor);
  const tiers = plan?.tiers ?? [];
  const isVerifiedAgency = organization?.agencyStatus === "verified";
  return {
    organization,
    isVerifiedAgency,
    state,
    tiers,
    nextListingCents: isVerifiedAgency && tiers.length ? nextUnitPrice(tiers, state?.billableExtra ?? 0) : null,
    monthlyCents: state?.subscriptionGrantsAccess ? amountForQuantity(tiers, state.subscription?.quantity ?? 0) : 0,
  };
}

async function ensureOwnerMembership(organizationId: string, userId: string, executor: DbExecutor) {
  await executor.insert(organizationMembers).values({ organizationId, userId, role: "owner", acceptedAt: new Date() }).onConflictDoNothing();
}

/** Declares (or re-declares after a refusal) the account's structure as an agency, for moderation. */
export async function requestAgencyStatus(actor: Actor, input: AgencyRequestInput): Promise<{ organizationId: string }> {
  return db.transaction(async (tx) => {
    let org = await findOwnedOrganization(actor.userId, tx);
    if (org?.agencyStatus === "verified") throw new ConflictError("Votre structure est déjà validée comme agence.");
    const values = { name: input.name, type: input.type, siret: input.siret, siren: sirenFromSiret(input.siret), addressLine1: input.addressLine1, postalCode: input.postalCode, city: input.city, agencyStatus: "pending" as const, agencyRequestedAt: new Date(), agencyReviewNote: null };
    if (org) {
      await tx.update(organizations).set(values).where(eq(organizations.id, org.id));
    } else {
      const taken = new Set((await tx.select({ slug: organizations.slug }).from(organizations)).map((r) => r.slug));
      const [row] = await tx.insert(organizations).values({ ...values, slug: resolveUniqueSlug(input.name, (c) => taken.has(c)), ownerUserId: actor.userId }).returning();
      if (!row) throw new Error("organization insert failed");
      org = row;
    }
    await ensureOwnerMembership(org.id, actor.userId, tx);
    // Every listing of the account belongs to its structure.
    await tx.update(professionals).set({ organizationId: org.id }).where(and(eq(professionals.ownerUserId, actor.userId), isNull(professionals.deletedAt)));
    await openModerationCase({ kind: "agency_review", resourceType: "organization", resourceId: org.id, openedByUserId: actor.userId, summary: `Demande de statut agence : « ${input.name} », SIRET ${input.siret}.` }, tx);
    await audit({ actorUserId: actor.userId, action: "organization.agency_requested", resourceType: "organization", resourceId: org.id, organizationId: org.id, metadata: { type: input.type } }, tx);
    await notify({ userId: actor.userId, type: "system", title: "Demande de statut agence envoyée", body: "Notre équipe vérifie votre structure. Vous pourrez ajouter des fiches dès la validation.", href: "/app/pro/structure", dedupeKey: `agency-request:${org.id}` }, tx);
    return { organizationId: org.id };
  });
}

/** Moderator decision on an `agency_review` case (called inside the moderation transaction). */
export async function decideAgency(actor: Actor, organizationId: string, decision: "approve" | "reject", reason: string, executor: DbExecutor): Promise<void> {
  requireGlobalPermission(actor, "moderation.decide");
  const [org] = await executor.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) throw new NotFoundError();
  if (org.agencyStatus === "none") throw new ValidationError("Aucune demande d'agence pour cette structure.");
  const agencyStatus = decision === "approve" ? "verified" : "rejected";
  await executor.update(organizations).set({ agencyStatus, agencyReviewedAt: new Date(), agencyReviewedBy: actor.userId, agencyReviewNote: reason }).where(eq(organizations.id, organizationId));
  await audit({ actorUserId: actor.userId, action: `organization.agency_${agencyStatus}`, resourceType: "organization", resourceId: organizationId, organizationId, reason }, executor);
  await notify(
    {
      userId: org.ownerUserId,
      type: decision === "approve" ? "profile_approved" : "profile_rejected",
      title: decision === "approve" ? "Votre structure est validée comme agence" : "Votre demande de statut agence n'est pas acceptée",
      body: reason,
      href: "/app/pro/structure",
    },
    executor,
  );
  // A refused or revoked agency keeps one visible listing.
  await reconcileAgencyHolds(organizationId, executor);
}

/** Listing kept online if the agency subscription stops. */
export async function setPrimaryListing(actor: Actor, professionalId: string): Promise<void> {
  const org = await findOwnedOrganization(actor.userId);
  if (!org) throw new NotFoundError();
  const [listing] = await db.select({ id: professionals.id }).from(professionals).where(and(eq(professionals.id, professionalId), eq(professionals.organizationId, org.id), isNull(professionals.deletedAt))).limit(1);
  if (!listing) throw new NotFoundError();
  await db.update(organizations).set({ primaryListingId: listing.id }).where(eq(organizations.id, org.id));
  await reconcileAgencyHolds(org.id);
}

/** "Ma fiche pro" for an independent, "Mes fiches pro" for an agency (request-cached, used by the shell). */
export const proNavLabel = cache(async (userId: string): Promise<string> => {
  const org = await findOwnedOrganization(userId);
  return org?.agencyStatus === "verified" ? "Mes fiches pro" : "Ma fiche pro";
});

/** The listing an independent already runs (they may not open another), or null. */
export async function existingIndependentListingId(userId: string, executor: DbExecutor = db): Promise<string | null> {
  const org = await findOwnedOrganization(userId, executor);
  if (org?.agencyStatus === "verified") return null;
  const [row] = await executor
    .select({ id: professionals.id })
    .from(professionals)
    .where(and(eq(professionals.ownerUserId, userId), isNull(professionals.deletedAt)))
    .orderBy(asc(professionals.createdAt))
    .limit(1);
  return row?.id ?? null;
}
