import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db";
import type { EditorialStatus, PartnershipStatus, VenueType } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";
import { generateReadableCode } from "@/lib/ids";
import { slugify } from "@/lib/sanitize";
import { getEnv } from "@/lib/env";
import { recordAudit } from "@/server/services/audit";
import { DomainError, NotFoundError } from "@/server/errors";

export type VenueInput = {
  name: string;
  slug?: string | null;
  type: VenueType;
  city: string;
  postalCode?: string | null;
  region?: string | null;
  officialWebsite?: string | null;
  summary: string;
  description: string;
  childrenSpaces?: string | null;
  constraints?: string | null;
  accessInfo?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  partnershipStatus: PartnershipStatus;
  illustrationKey: string;
  isDemo?: boolean;
};

export const VENUE_ILLUSTRATIONS = ["domaine", "chateau", "salle", "jardin", "orangerie"] as const;

export async function listVenuesForAdmin() {
  return db.partnerVenue.findMany({
    orderBy: [{ editorialStatus: "asc" }, { name: "asc" }],
    include: { _count: { select: { referrals: true, events: true } }, partnerUser: { select: { email: true } } },
  });
}

export async function getVenueForAdmin(venueId: string) {
  return db.partnerVenue.findUnique({
    where: { id: venueId },
    include: {
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      partnerUser: { select: { id: true, email: true, name: true } },
      events: { select: { id: true, reference: true, title: true, status: true, date: true }, orderBy: { date: "desc" }, take: 20 },
      referrals: { select: { id: true, createdAt: true, sourceKind: true, request: { select: { event: { select: { id: true, reference: true, status: true } } } } }, orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "lieu";
  let candidate = root;
  let suffix = 2;
  while (true) {
    const clash = await db.partnerVenue.findFirst({ where: { slug: candidate, id: excludeId ? { not: excludeId } : undefined }, select: { id: true } });
    if (!clash) return candidate;
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
}

async function uniqueReferralCode(): Promise<string> {
  while (true) {
    const code = generateReadableCode(8);
    const clash = await db.partnerVenue.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!clash) return code;
  }
}

export async function createVenue(input: VenueInput, actor: SessionUser): Promise<string> {
  const slug = await uniqueSlug(input.slug || input.name);
  const referralCode = await uniqueReferralCode();
  const venue = await db.$transaction(async (tx) => {
    const created = await tx.partnerVenue.create({ data: { ...input, slug, referralCode, editorialStatus: "DRAFT", isDemo: input.isDemo ?? false } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "venue.created", entityType: "PartnerVenue", entityId: created.id, summary: input.name }, tx);
    return created;
  });
  return venue.id;
}

export async function updateVenue(venueId: string, input: Partial<VenueInput>, actor: SessionUser): Promise<void> {
  const { slug, ...rest } = input;
  const data: Prisma.PartnerVenueUncheckedUpdateInput = { ...rest };
  if (slug !== undefined) {
    const current = await db.partnerVenue.findUnique({ where: { id: venueId }, select: { name: true } });
    data.slug = await uniqueSlug(slug || rest.name || current?.name || "lieu", venueId);
  }
  await db.$transaction(async (tx) => {
    await tx.partnerVenue.update({ where: { id: venueId }, data });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "venue.updated", entityType: "PartnerVenue", entityId: venueId }, tx);
  });
}

const EDITORIAL_TRANSITIONS: Record<EditorialStatus, EditorialStatus[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["PUBLISHED", "DRAFT"],
  PUBLISHED: ["DRAFT", "REVIEW"],
};

export async function setEditorialStatus(venueId: string, status: EditorialStatus, actor: SessionUser): Promise<void> {
  const venue = await db.partnerVenue.findUnique({ where: { id: venueId } });
  if (!venue) throw new NotFoundError("Lieu introuvable.");
  if (!EDITORIAL_TRANSITIONS[venue.editorialStatus].includes(status)) throw new DomainError(`Passage ${venue.editorialStatus} → ${status} non autorisé.`);
  if (status === "PUBLISHED" && (venue.summary.trim().length < 40 || venue.description.trim().length < 200)) {
    throw new DomainError("Une page publiée doit apporter une présentation originale (résumé d’au moins 40 caractères, description d’au moins 200).");
  }
  await db.$transaction(async (tx) => {
    await tx.partnerVenue.update({ where: { id: venueId }, data: { editorialStatus: status, publishedAt: status === "PUBLISHED" ? venue.publishedAt ?? new Date() : venue.publishedAt } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: `venue.editorial.${status.toLowerCase()}`, entityType: "PartnerVenue", entityId: venueId }, tx);
  });
}

export async function markVenueVerified(venueId: string, actor: SessionUser): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.partnerVenue.update({ where: { id: venueId }, data: { lastVerifiedAt: new Date() } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "venue.verified", entityType: "PartnerVenue", entityId: venueId }, tx);
  });
}

export async function listPublishedVenues() {
  return db.partnerVenue.findMany({ where: { editorialStatus: "PUBLISHED" }, orderBy: { name: "asc" } });
}

export async function getPublishedVenueBySlug(slug: string) {
  return db.partnerVenue.findFirst({ where: { slug, editorialStatus: "PUBLISHED" } });
}

/** Aggregated figures only: counts of referred requests and confirmed events. */
export async function getVenueStats(venueId: string) {
  const [requests, confirmedFromReferrals, confirmedAtVenue] = await Promise.all([
    db.referral.count({ where: { venueId } }),
    db.event.count({ where: { status: { in: ["CONFIRMED", "COMPLETED"] }, request: { referral: { venueId } } } }),
    db.event.count({ where: { venueId, status: { in: ["CONFIRMED", "COMPLETED"] } } }),
  ]);
  return { requests, confirmedEvents: Math.max(confirmedFromReferrals, confirmedAtVenue) };
}

export function referralUrlFor(code: string): string {
  return `${getEnv().APP_URL}/p/${code}`;
}

/** Resolves a referral code (non-sensitive identifier) to an eligible venue. */
export async function resolveReferralCode(code: string | null | undefined) {
  if (!code || !/^[a-z0-9]{6,12}$/i.test(code)) return null;
  return db.partnerVenue.findFirst({ where: { referralCode: code.toLowerCase(), partnershipStatus: { not: "ENDED" } }, select: { id: true, name: true, slug: true, referralCode: true } });
}

export async function getPartnerPortal(userId: string) {
  const venue = await db.partnerVenue.findUnique({ where: { partnerUserId: userId } });
  if (!venue) throw new NotFoundError("Aucun lieu n’est rattaché à ce compte.");
  const stats = await getVenueStats(venue.id);
  return { venue, stats, referralUrl: referralUrlFor(venue.referralCode) };
}

export async function linkPartnerUser(venueId: string, input: { email: string; name: string }, actor: SessionUser): Promise<void> {
  const email = input.email.trim().toLowerCase();
  await db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });
    const user = existing ?? (await tx.user.create({ data: { email, name: input.name, role: "PARTNER" } }));
    if (user.role !== "PARTNER") throw new DomainError("Cette adresse est déjà utilisée par un autre type de compte.");
    await tx.partnerVenue.update({ where: { id: venueId }, data: { partnerUserId: user.id } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "venue.partner-user.linked", entityType: "PartnerVenue", entityId: venueId }, tx);
  });
}
