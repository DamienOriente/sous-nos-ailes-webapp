import { and, asc, count, desc, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { organizationInvitations, organizationMembers, organizations, users } from "@/db/schema";
import { hashToken, randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { ConflictError, ForbiddenError, NotFoundError, RateLimitedError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getOrganizationMembership } from "@/modules/authorization";
import { enqueueEmail } from "@/modules/notifications/application/email-outbox";
import { notify } from "@/modules/notifications/application/notification-service";
import {
  canEditMember,
  canManageMembers,
  evaluateOrganizationInvitation,
  INVITABLE_ROLES,
  ORGANIZATION_INVITATION_TTL_DAYS,
  ORGANIZATION_INVITATIONS_PER_DAY,
  ORGANIZATION_ROLE_LABELS,
  type InvitableRole,
  type InviteMemberInput,
  type OrganizationInvitationState,
  type OrganizationRole,
} from "@/modules/professionals/domain/members";
import { audit } from "./audit";

/**
 * Agency team (2026-10-18): the owner or an admin of a verified agency invites people by
 * e-mail (single-use signed link), changes their role or removes them. The membership row
 * only exists once the invitation is accepted, and authorisation ignores rows without
 * `accepted_at`. Billing stays with the owner (see listing-slot and agency-billing).
 */
type OrganizationRow = typeof organizations.$inferSelect;

export type ManagerContext = { organization: OrganizationRow; role: OrganizationRole };

async function loadOrganization(organizationId: string, executor: DbExecutor): Promise<OrganizationRow | null> {
  const [org] = await executor.select().from(organizations).where(and(eq(organizations.id, organizationId), isNull(organizations.deletedAt))).limit(1);
  return org ?? null;
}

/** Role of the actor in the organisation: the owner column wins, then the accepted membership. */
async function actorRole(actor: Actor, org: OrganizationRow, executor: DbExecutor): Promise<OrganizationRole | null> {
  if (org.ownerUserId === actor.userId) return "owner";
  return (await getOrganizationMembership(actor, org.id, executor))?.role ?? null;
}

/**
 * Owner or admin of a verified agency. Outsiders get NotFound (anti-enumeration), members
 * without the right get Forbidden, a structure that is not a verified agency gets Conflict.
 */
export async function requireMemberManager(actor: Actor, organizationId: string, executor: DbExecutor = db): Promise<ManagerContext> {
  const org = await loadOrganization(organizationId, executor);
  if (!org) throw new NotFoundError();
  const role = await actorRole(actor, org, executor);
  if (!role) throw new NotFoundError();
  if (org.agencyStatus !== "verified") throw new ConflictError("Seule une agence validée peut ajouter des membres à son équipe.");
  if (!canManageMembers(role)) throw new ForbiddenError("Seuls le propriétaire et les administrateurs de l'agence gèrent l'équipe.");
  return { organization: org, role };
}

export type AgencyMembership = { organizationId: string; name: string; role: OrganizationRole; canManageMembers: boolean };

/** Verified agencies the actor owns or belongs to (accepted memberships only). */
export async function listMyAgencies(actor: Actor, executor: DbExecutor = db): Promise<AgencyMembership[]> {
  // organization_members is unique per (organisation, user): one row per agency.
  const rows = await executor
    .select({ id: organizations.id, name: organizations.name, ownerUserId: organizations.ownerUserId, role: organizationMembers.role })
    .from(organizations)
    .leftJoin(organizationMembers, and(eq(organizationMembers.organizationId, organizations.id), eq(organizationMembers.userId, actor.userId), isNotNull(organizationMembers.acceptedAt)))
    .where(and(isNull(organizations.deletedAt), eq(organizations.agencyStatus, "verified"), or(eq(organizations.ownerUserId, actor.userId), isNotNull(organizationMembers.id))))
    .orderBy(asc(organizations.createdAt));
  return rows
    .map((r) => {
      const role: OrganizationRole = r.ownerUserId === actor.userId ? "owner" : (r.role ?? "collaborator");
      return { organizationId: r.id, name: r.name, role, canManageMembers: canManageMembers(role) };
    })
    .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
}

export type MemberRow = { id: string; userId: string; name: string; email: string; role: OrganizationRole; acceptedAt: Date | null; editable: boolean };
export type PendingInvitationRow = { id: string; email: string; role: OrganizationRole; expiresAt: Date; invitedByName: string | null; createdAt: Date };
export type OrganizationTeam = { organizationId: string; name: string; actorRole: OrganizationRole; members: MemberRow[]; invitations: PendingInvitationRow[] };

export async function listMembers(actor: Actor, organizationId: string, executor: DbExecutor = db): Promise<OrganizationTeam> {
  const { organization, role } = await requireMemberManager(actor, organizationId, executor);
  const members = await executor
    .select({ id: organizationMembers.id, userId: organizationMembers.userId, name: users.name, email: users.email, role: organizationMembers.role, acceptedAt: organizationMembers.acceptedAt })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(and(eq(organizationMembers.organizationId, organizationId), isNotNull(organizationMembers.acceptedAt)))
    .orderBy(asc(organizationMembers.acceptedAt));
  const invitations = await executor
    .select({ id: organizationInvitations.id, email: organizationInvitations.email, role: organizationInvitations.role, expiresAt: organizationInvitations.expiresAt, invitedByName: users.name, createdAt: organizationInvitations.createdAt })
    .from(organizationInvitations)
    .leftJoin(users, eq(users.id, organizationInvitations.invitedByUserId))
    .where(and(eq(organizationInvitations.organizationId, organizationId), isNull(organizationInvitations.acceptedAt), isNull(organizationInvitations.revokedAt), gt(organizationInvitations.expiresAt, new Date())))
    .orderBy(desc(organizationInvitations.createdAt));
  const rows = members
    .map((m) => {
      const isOwner = m.userId === organization.ownerUserId;
      const r: OrganizationRole = isOwner ? "owner" : m.role;
      return { ...m, role: r, editable: canEditMember({ role: r, isOrganizationOwner: isOwner }) };
    })
    .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
  return { organizationId, name: organization.name, actorRole: role, members: rows, invitations };
}

export function organizationInvitationUrl(token: string): string {
  return new URL(`/app/pro/structure/invitation/${token}`, env.APP_URL).toString();
}

/**
 * Sends a single-use link to `email`. A previous pending invitation to the same address is
 * replaced (re-sending is the way to change the role of a pending invite). Returns the link
 * for tests; actions never return it to the browser.
 */
export async function inviteMember(actor: Actor, organizationId: string, input: InviteMemberInput): Promise<{ invitationId: string; url: string; expiresAt: Date }> {
  if (!(INVITABLE_ROLES as readonly string[]).includes(input.role)) throw new ValidationError("Rôle invalide.");
  const email = input.email.trim().toLowerCase();
  return db.transaction(async (tx) => {
    // Serialises concurrent invitations of the same agency (rate limit + replacement).
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`org-invite:${organizationId}`}))`);
    const { organization } = await requireMemberManager(actor, organizationId, tx);
    const [owner] = await tx.select({ email: users.email }).from(users).where(eq(users.id, organization.ownerUserId)).limit(1);
    if (owner?.email.toLowerCase() === email) throw new ConflictError("Cette adresse est celle du propriétaire de l'agence.");
    const [already] = await tx
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(and(eq(organizationMembers.organizationId, organizationId), isNotNull(organizationMembers.acceptedAt), sql`lower(${users.email}) = ${email}`))
      .limit(1);
    if (already) throw new ConflictError("Cette personne fait déjà partie de l'équipe.");

    const since = new Date(Date.now() - 86_400_000);
    const [recent] = await tx.select({ n: count() }).from(organizationInvitations).where(and(eq(organizationInvitations.organizationId, organizationId), gt(organizationInvitations.createdAt, since)));
    if ((recent?.n ?? 0) >= ORGANIZATION_INVITATIONS_PER_DAY) throw new RateLimitedError("Trop d'invitations envoyées aujourd'hui. Réessayez demain.");

    const now = new Date();
    await tx
      .update(organizationInvitations)
      .set({ revokedAt: now })
      .where(and(eq(organizationInvitations.organizationId, organizationId), eq(organizationInvitations.email, email), isNull(organizationInvitations.acceptedAt), isNull(organizationInvitations.revokedAt)));

    const token = randomToken(32);
    const expiresAt = new Date(now.getTime() + ORGANIZATION_INVITATION_TTL_DAYS * 86_400_000);
    const [row] = await tx
      .insert(organizationInvitations)
      .values({ organizationId, email, role: input.role, tokenHash: hashToken(token), invitedByUserId: actor.userId, expiresAt })
      .returning({ id: organizationInvitations.id });
    if (!row) throw new Error("organization invitation insert failed");
    const url = organizationInvitationUrl(token);
    await enqueueEmail(
      {
        toEmail: email,
        subject: `${actor.name} vous invite dans l'équipe de ${organization.name} sur Sous Nos Ailes`,
        templateKey: "invitation",
        payload: {
          heading: `Rejoindre l'équipe de ${organization.name}`,
          intro: `${actor.name} vous propose de rejoindre l'agence ${organization.name} en tant que ${ORGANIZATION_ROLE_LABELS[input.role].toLowerCase()}. Connectez-vous ou créez un compte avec cette adresse e-mail pour accepter. Ce lien est personnel, utilisable une seule fois et valable ${ORGANIZATION_INVITATION_TTL_DAYS} jours.`,
          ctaLabel: "Voir l'invitation",
          url,
        },
      },
      tx,
    );
    await audit({ actorUserId: actor.userId, action: "organization.member_invited", resourceType: "organization_invitation", resourceId: row.id, organizationId, metadata: { role: input.role } }, tx);
    return { invitationId: row.id, url, expiresAt };
  });
}

export async function revokeOrganizationInvitation(actor: Actor, organizationId: string, invitationId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await requireMemberManager(actor, organizationId, tx);
    const [row] = await tx
      .update(organizationInvitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(organizationInvitations.id, invitationId), eq(organizationInvitations.organizationId, organizationId), isNull(organizationInvitations.acceptedAt), isNull(organizationInvitations.revokedAt)))
      .returning({ id: organizationInvitations.id });
    if (!row) throw new NotFoundError();
    await audit({ actorUserId: actor.userId, action: "organization.invitation_revoked", resourceType: "organization_invitation", resourceId: invitationId, organizationId }, tx);
  });
}

export type OrganizationInvitationPreview = {
  organizationName: string;
  role: OrganizationRole;
  roleLabel: string;
  inviterName: string | null;
  email: string;
  expiresAt: Date;
  state: OrganizationInvitationState | "agency_unavailable";
};

async function loadInvitationByToken(token: string, executor: DbExecutor, lock = false) {
  const q = executor
    .select({ invitation: organizationInvitations, organization: organizations, inviterName: users.name })
    .from(organizationInvitations)
    .innerJoin(organizations, eq(organizations.id, organizationInvitations.organizationId))
    .leftJoin(users, eq(users.id, organizationInvitations.invitedByUserId))
    .where(eq(organizationInvitations.tokenHash, hashToken(token)))
    .limit(1);
  const [row] = lock ? await q.for("update", { of: organizationInvitations }) : await q;
  return row ?? null;
}

/** What the accept page shows. Null when the token matches nothing. */
export async function previewOrganizationInvitation(token: string, executor: DbExecutor = db): Promise<OrganizationInvitationPreview | null> {
  if (!token || token.length > 128) return null;
  const row = await loadInvitationByToken(token, executor);
  if (!row) return null;
  const usable = !row.organization.deletedAt && row.organization.agencyStatus === "verified";
  const state = evaluateOrganizationInvitation(row.invitation);
  return {
    organizationName: row.organization.name,
    role: row.invitation.role,
    roleLabel: ORGANIZATION_ROLE_LABELS[row.invitation.role],
    inviterName: row.inviterName,
    email: row.invitation.email,
    expiresAt: row.invitation.expiresAt,
    state: state === "valid" && !usable ? "agency_unavailable" : state,
  };
}

/**
 * Accepts as the signed-in user. The account e-mail must be the invited address and be
 * verified: the link alone is not enough, so a forwarded or leaked e-mail grants nothing.
 */
export async function acceptOrganizationInvitation(actor: Actor, token: string): Promise<{ organizationId: string }> {
  return db.transaction(async (tx) => {
    const row = await loadInvitationByToken(token, tx, true);
    if (!row) throw new NotFoundError("Ce lien d'invitation est invalide.");
    const { invitation, organization } = row;
    const state = evaluateOrganizationInvitation(invitation);
    if (state === "revoked") throw new ConflictError("Cette invitation a été annulée par l'agence.");
    if (state === "used") throw new ConflictError("Cette invitation a déjà été utilisée.");
    if (state === "expired") throw new ConflictError("Cette invitation a expiré. Demandez un nouveau lien à l'agence.");
    if (organization.deletedAt || organization.agencyStatus !== "verified") throw new ConflictError("Cette agence n'accepte plus de nouveaux membres.");
    if (actor.email.toLowerCase() !== invitation.email) throw new ForbiddenError(`Cette invitation a été envoyée à ${invitation.email}. Connectez-vous avec cette adresse pour l'accepter.`);
    if (!actor.emailVerified) throw new ForbiddenError("Confirmez d'abord votre adresse e-mail, puis rouvrez ce lien.");
    if (organization.ownerUserId === actor.userId) throw new ConflictError("Vous êtes déjà propriétaire de cette agence.");

    const now = new Date();
    const [existing] = await tx
      .select({ id: organizationMembers.id, acceptedAt: organizationMembers.acceptedAt })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, organization.id), eq(organizationMembers.userId, actor.userId)))
      .limit(1);
    if (existing?.acceptedAt) throw new ConflictError("Vous faites déjà partie de l'équipe de cette agence.");
    let memberId: string;
    if (existing) {
      await tx.update(organizationMembers).set({ role: invitation.role, invitedByUserId: invitation.invitedByUserId, acceptedAt: now }).where(eq(organizationMembers.id, existing.id));
      memberId = existing.id;
    } else {
      const [m] = await tx
        .insert(organizationMembers)
        .values({ organizationId: organization.id, userId: actor.userId, role: invitation.role, invitedByUserId: invitation.invitedByUserId, acceptedAt: now })
        .returning({ id: organizationMembers.id });
      if (!m) throw new Error("organization member insert failed");
      memberId = m.id;
    }
    await tx.update(organizationInvitations).set({ acceptedAt: now, acceptedByUserId: actor.userId }).where(eq(organizationInvitations.id, invitation.id));
    await audit({ actorUserId: actor.userId, action: "organization.member_joined", resourceType: "organization_member", resourceId: memberId, organizationId: organization.id, metadata: { role: invitation.role, invitationId: invitation.id } }, tx);
    const recipients = new Set([organization.ownerUserId, invitation.invitedByUserId].filter((v): v is string => Boolean(v)));
    for (const userId of recipients) {
      await notify({ userId, type: "system", title: `${actor.name} a rejoint l'équipe de ${organization.name}`, body: `Rôle : ${ORGANIZATION_ROLE_LABELS[invitation.role].toLowerCase()}.`, href: "/app/pro/structure", dedupeKey: `org-join:${memberId}` }, tx);
    }
    return { organizationId: organization.id };
  });
}

async function loadEditableMember(organizationId: string, ownerUserId: string, memberId: string, executor: DbExecutor) {
  const [m] = await executor
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, organizationId), isNotNull(organizationMembers.acceptedAt)))
    .limit(1);
  if (!m) throw new NotFoundError();
  if (!canEditMember({ role: m.role, isOrganizationOwner: m.userId === ownerUserId })) throw new ForbiddenError("Le propriétaire de l'agence ne peut pas être modifié ni retiré.");
  return m;
}

export async function changeMemberRole(actor: Actor, organizationId: string, memberId: string, role: InvitableRole): Promise<void> {
  if (!(INVITABLE_ROLES as readonly string[]).includes(role)) throw new ValidationError("Rôle invalide.");
  await db.transaction(async (tx) => {
    const { organization } = await requireMemberManager(actor, organizationId, tx);
    const member = await loadEditableMember(organizationId, organization.ownerUserId, memberId, tx);
    if (member.role === role) return;
    await tx.update(organizationMembers).set({ role }).where(eq(organizationMembers.id, memberId));
    await audit({ actorUserId: actor.userId, action: "organization.member_role_changed", resourceType: "organization_member", resourceId: memberId, organizationId, metadata: { from: member.role, to: role, userId: member.userId } }, tx);
    await notify({ userId: member.userId, type: "system", title: `Votre rôle dans l'équipe de ${organization.name} a changé`, body: `Nouveau rôle : ${ORGANIZATION_ROLE_LABELS[role].toLowerCase()}.`, href: "/app/pro" }, tx);
  });
}

export async function removeMember(actor: Actor, organizationId: string, memberId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { organization } = await requireMemberManager(actor, organizationId, tx);
    const member = await loadEditableMember(organizationId, organization.ownerUserId, memberId, tx);
    await tx.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
    await audit({ actorUserId: actor.userId, action: "organization.member_removed", resourceType: "organization_member", resourceId: memberId, organizationId, metadata: { role: member.role, userId: member.userId } }, tx);
    if (member.userId !== actor.userId) {
      await notify({ userId: member.userId, type: "system", title: `Vous ne faites plus partie de l'équipe de ${organization.name}`, body: "Vous n'avez plus accès aux fiches de cette agence.", href: "/app" }, tx);
    }
  });
}
