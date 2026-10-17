import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db";
import type { AvailabilityKind, CostBasis, ProviderVettingStatus, QualificationStatus } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/sanitize";
import { recordAudit } from "@/server/services/audit";
import { expireStaleInvitations } from "@/server/services/invitations";
import { sendMagicLinkIfUserExists } from "@/server/services/users";
import { DomainError, NotFoundError } from "@/server/errors";

export async function listProviders(filters: { search?: string; vetting?: ProviderVettingStatus | "ALL" } = {}) {
  const where: Prisma.ProviderProfileWhereInput = {};
  if (filters.vetting && filters.vetting !== "ALL") where.vettingStatus = filters.vetting;
  if (filters.search) {
    where.OR = [
      { displayName: { contains: filters.search, mode: "insensitive" } },
      { city: { contains: filters.search, mode: "insensitive" } },
      { sector: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return db.providerProfile.findMany({
    where,
    orderBy: { displayName: "asc" },
    include: {
      user: { select: { email: true, phone: true } },
      qualifications: true,
      _count: { select: { assignments: { where: { status: "ASSIGNED" } } } },
    },
  });
}

export async function getProviderForAdmin(providerId: string) {
  return db.providerProfile.findUnique({
    where: { id: providerId },
    include: {
      user: { select: { id: true, email: true, phone: true, name: true, isActive: true } },
      qualifications: { orderBy: { createdAt: "asc" } },
      availabilities: { orderBy: { startsAt: "asc" } },
      assignments: { include: { event: { select: { id: true, reference: true, title: true, date: true, startsAt: true, endsAt: true, status: true } } }, orderBy: { assignedAt: "desc" } },
      invitations: { include: { event: { select: { id: true, reference: true, title: true, date: true } } }, orderBy: { sentAt: "desc" } },
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
}

export type ProviderInput = {
  email: string;
  name: string;
  phone?: string | null;
  displayName: string;
  city: string;
  postalCode?: string | null;
  sector: string;
  bio?: string | null;
  skills: string[];
  costBasis: CostBasis;
  agreedCostCents: number;
  costNote?: string | null;
};

export async function createProvider(input: ProviderInput, actor: SessionUser): Promise<string> {
  const email = normalizeEmail(input.email);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new DomainError("Un compte existe déjà avec cette adresse email.");
  const profile = await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, name: input.name, phone: input.phone ?? null, role: "PROVIDER" } });
    const created = await tx.providerProfile.create({
      data: {
        userId: user.id,
        displayName: input.displayName,
        city: input.city,
        postalCode: input.postalCode ?? null,
        sector: input.sector,
        bio: input.bio ?? null,
        skills: input.skills,
        costBasis: input.costBasis,
        agreedCostCents: input.agreedCostCents,
        costNote: input.costNote ?? null,
      },
    });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "provider.created", entityType: "ProviderProfile", entityId: created.id, summary: input.displayName }, tx);
    return created;
  });
  await sendMagicLinkIfUserExists(email);
  return profile.id;
}

export async function updateProvider(providerId: string, input: Partial<Omit<ProviderInput, "email">> & { isActive?: boolean }, actor: SessionUser): Promise<void> {
  const profile = await db.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new NotFoundError("Intervenant·e introuvable.");
  const { name, phone, ...profileData } = input;
  await db.$transaction(async (tx) => {
    if (name !== undefined || phone !== undefined) {
      await tx.user.update({ where: { id: profile.userId }, data: { ...(name !== undefined ? { name } : {}), ...(phone !== undefined ? { phone } : {}) } });
    }
    await tx.providerProfile.update({ where: { id: providerId }, data: profileData });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "provider.updated", entityType: "ProviderProfile", entityId: providerId }, tx);
  });
}

export async function setVettingStatus(providerId: string, status: ProviderVettingStatus, note: string | null, actor: SessionUser): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.providerProfile.update({ where: { id: providerId }, data: { vettingStatus: status, vettingNote: note, vettedAt: status === "ACTIVE" ? new Date() : null } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "provider.vetting", entityType: "ProviderProfile", entityId: providerId, summary: `Vérification : ${status}` }, tx);
  });
}

export async function addQualification(providerId: string, input: { label: string; issuer?: string | null; year?: number | null }, actorUserId: string, actorRole: SessionUser["role"]): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.providerQualification.create({ data: { providerId, label: input.label, issuer: input.issuer ?? null, year: input.year ?? null, status: "DECLARED" } });
    await recordAudit({ actorId: actorUserId, actorRole, action: "provider.qualification.declared", entityType: "ProviderProfile", entityId: providerId, summary: input.label }, tx);
  });
}

export async function setQualificationStatus(qualificationId: string, status: QualificationStatus, note: string | null, actor: SessionUser): Promise<void> {
  const qualification = await db.providerQualification.findUnique({ where: { id: qualificationId } });
  if (!qualification) throw new NotFoundError("Qualification introuvable.");
  await db.$transaction(async (tx) => {
    await tx.providerQualification.update({ where: { id: qualificationId }, data: { status, verifiedAt: status === "VERIFIED" ? new Date() : null, verifiedNote: note } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "provider.qualification.status", entityType: "ProviderProfile", entityId: qualification.providerId, summary: `${qualification.label} : ${status}` }, tx);
  });
}

export async function addAvailability(providerId: string, input: { kind: AvailabilityKind; startsAt: Date; endsAt: Date; note?: string | null }, actorUserId: string, actorRole: SessionUser["role"]): Promise<void> {
  if (input.endsAt.getTime() <= input.startsAt.getTime()) throw new DomainError("La fin doit être postérieure au début.");
  await db.$transaction(async (tx) => {
    await tx.availability.create({ data: { providerId, kind: input.kind, startsAt: input.startsAt, endsAt: input.endsAt, note: input.note ?? null } });
    await recordAudit({ actorId: actorUserId, actorRole, action: input.kind === "AVAILABLE" ? "provider.availability.added" : "provider.unavailability.added", entityType: "ProviderProfile", entityId: providerId }, tx);
  });
}

export async function removeAvailability(providerId: string, availabilityId: string): Promise<void> {
  await db.availability.deleteMany({ where: { id: availabilityId, providerId } });
}

/** Everything the provider portal shows. Client identities are withheld until assignment. */
export async function getProviderPortal(providerId: string) {
  await expireStaleInvitations();
  const profile = await db.providerProfile.findUnique({
    where: { id: providerId },
    include: {
      qualifications: { orderBy: { createdAt: "asc" } },
      availabilities: { orderBy: { startsAt: "asc" } },
      invitations: {
        where: { status: { in: ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"] } },
        include: { event: { include: { venue: { select: { name: true, city: true } } } }, assignment: { select: { id: true } } },
        orderBy: { sentAt: "desc" },
      },
      assignments: {
        where: { status: "ASSIGNED" },
        include: { event: { include: { venue: { select: { name: true, city: true, accessInfo: true } } } } },
        orderBy: { event: { startsAt: "asc" } },
      },
    },
  });
  if (!profile) throw new NotFoundError("Profil introuvable.");
  return profile;
}

/** Operational projection of an event for a provider: nothing about the client's identity before assignment. */
export function providerEventView(event: {
  id: string;
  reference: string;
  title: string;
  eventType: string;
  date: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  city: string;
  postalCode: string;
  venueName: string | null;
  childrenUnder3: number;
  children3to5: number;
  children6to10: number;
  children11plus: number;
  parentsOnSite: string;
  dedicatedSpace: string;
  spaceDescription: string | null;
  meetingPoint: string | null;
  onSiteContactName: string | null;
  onSiteContactPhone: string | null;
  scheduleNotes: string | null;
  venue: { name: string; city: string; accessInfo?: string | null } | null;
}, options: { assigned: boolean }) {
  const base = {
    id: event.id,
    reference: event.reference,
    title: event.title,
    eventType: event.eventType,
    date: event.date,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    city: event.city,
    venueName: event.venue?.name ?? event.venueName,
    headcount: { childrenUnder3: event.childrenUnder3, children3to5: event.children3to5, children6to10: event.children6to10, children11plus: event.children11plus },
    parentsOnSite: event.parentsOnSite,
    dedicatedSpace: event.dedicatedSpace,
  };
  if (!options.assigned) return { ...base, assigned: false as const };
  return {
    ...base,
    assigned: true as const,
    postalCode: event.postalCode,
    spaceDescription: event.spaceDescription,
    meetingPoint: event.meetingPoint,
    onSiteContactName: event.onSiteContactName,
    onSiteContactPhone: event.onSiteContactPhone,
    scheduleNotes: event.scheduleNotes,
    accessInfo: event.venue?.accessInfo ?? null,
  };
}
