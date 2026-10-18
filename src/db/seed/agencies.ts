import { eq, inArray } from "drizzle-orm";
import { organizationMembers, organizations, plans, professionals, subscriptions } from "@/db/schema";
import { openModerationCase } from "@/modules/moderation/application/moderation-service";
import { AGENCY_PLAN_KEY } from "@/modules/billing/application/agency-holds";
import type { SeedContext } from "./context";

/**
 * Demo structures: one verified agency with three listings (the first included, two paid
 * through a mock agency subscription) and one association whose agency request waits for
 * a moderator. SIRET numbers start with 999: checksum-valid but fictitious on purpose.
 */
const DAY = 24 * 3600 * 1000;

type DemoOrg = {
  slug: string;
  name: string;
  type: "company" | "association";
  siret: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  ownerKey: string;
  status: "verified" | "pending";
  listingSlugs: string[];
};

const ORGS: DemoOrg[] = [
  {
    slug: "maison-lumiere-evenements",
    name: "Maison Lumière Évènements",
    type: "company",
    siret: "99900001000010",
    addressLine1: "12 rue Mercière",
    postalCode: "69002",
    city: "Lyon",
    ownerKey: "agence",
    status: "verified",
    listingSlugs: ["maison-lumiere-decoration", "maison-lumiere-mobilier", "maison-lumiere-animation"],
  },
  {
    slug: "atelier-confettis",
    name: "Atelier Confettis",
    type: "association",
    siret: "99900002000019",
    addressLine1: "4 quai de la Fosse",
    postalCode: "44000",
    city: "Nantes",
    ownerKey: "agenceAttente",
    status: "pending",
    listingSlugs: ["atelier-confettis-magie"],
  },
];

export async function seed(ctx: SeedContext): Promise<void> {
  const { db, now } = ctx;
  const moderator = ctx.users.moderator ?? null;
  for (const o of ORGS) {
    const ownerUserId = ctx.users[o.ownerKey];
    if (!ownerUserId) throw new Error(`demo user ${o.ownerKey} missing`);
    const values = {
      name: o.name,
      type: o.type,
      siret: o.siret,
      siren: o.siret.slice(0, 9),
      addressLine1: o.addressLine1,
      postalCode: o.postalCode,
      city: o.city,
      ownerUserId,
      agencyStatus: o.status,
      agencyRequestedAt: new Date(now.getTime() - (o.status === "verified" ? 75 : 2) * DAY),
      agencyReviewedAt: o.status === "verified" ? new Date(now.getTime() - 70 * DAY) : null,
      agencyReviewedBy: o.status === "verified" ? moderator : null,
      agencyReviewNote: o.status === "verified" ? "SIRET rapproché de l'annuaire des entreprises, trois activités distinctes justifiant trois fiches." : null,
    };
    const [org] = await db.insert(organizations).values({ ...values, slug: o.slug }).onConflictDoUpdate({ target: organizations.slug, set: values }).returning({ id: organizations.id });
    if (!org) throw new Error("organization upsert failed");
    await db.insert(organizationMembers).values({ organizationId: org.id, userId: ownerUserId, role: "owner", acceptedAt: now }).onConflictDoNothing();
    const listings = await db.select({ id: professionals.id, slug: professionals.slug }).from(professionals).where(inArray(professionals.slug, o.listingSlugs));
    await db.update(professionals).set({ organizationId: org.id, billingHoldAt: null }).where(inArray(professionals.id, listings.map((l) => l.id)));
    const primary = listings.find((l) => l.slug === o.listingSlugs[0]);
    await db.update(organizations).set({ primaryListingId: primary?.id ?? null }).where(eq(organizations.id, org.id));

    if (o.status === "verified") {
      const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.key, AGENCY_PLAN_KEY)).limit(1);
      if (!plan) throw new Error("agency plan missing");
      const sub = {
        userId: ownerUserId,
        organizationId: org.id,
        planId: plan.id,
        quantity: o.listingSlugs.length - 1,
        status: "active" as const,
        provider: "mock",
        currentPeriodStart: new Date(now.getTime() - 10 * DAY),
        currentPeriodEnd: new Date(now.getTime() + 20 * DAY),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        endedAt: null,
      };
      await db
        .insert(subscriptions)
        .values({ ...sub, stripeSubscriptionId: `mock_sub_demo_${o.slug}` })
        .onConflictDoUpdate({ target: subscriptions.stripeSubscriptionId, set: sub });
    } else {
      await openModerationCase(
        { kind: "agency_review", resourceType: "organization", resourceId: org.id, openedByUserId: ownerUserId, summary: `Demande de statut agence : « ${o.name} », SIRET ${o.siret}.` },
        db,
      );
    }
  }
}
