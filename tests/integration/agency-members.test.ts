/**
 * Agency team: invitations by e-mail (single-use token), acceptance, role changes, removal,
 * non-accepted memberships granting nothing, and billing kept with the owner.
 */
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { db } from "@/db/client";
import { auditLogs, emailOutbox, notifications, organizationInvitations, organizationMembers, organizations, professionalCategories, professionals, users } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, isAppError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getProfessionalAccess, requireProfessionalManage } from "@/modules/authorization";
import { startAgencyCheckout } from "@/modules/billing/application/agency-billing";
import { loadAgencyPlan } from "@/modules/billing/application/agency-holds";
import { assertListingSlot } from "@/modules/professionals/application/listing-slot";
import {
  acceptOrganizationInvitation,
  changeMemberRole,
  inviteMember,
  listMembers,
  listMyAgencies,
  previewOrganizationInvitation,
  removeMember,
  revokeOrganizationInvitation,
} from "@/modules/professionals/application/member-service";
import { listManagedListings } from "@/modules/professionals/application/professional-service";

const RUN = "itest-orgmembers";
const mk = (k: string, emailVerified = true): Actor => ({ userId: `${RUN}-${k}`, email: `${RUN}-${k}@sousnosailes.test`, name: `Itest ${k}`, globalRole: "user", emailVerified, isDemo: false });
const OWNER = mk("owner");
const ADMIN = mk("admin");
const MANAGER = mk("manager");
const OUTSIDER = mk("outsider");
const UNVERIFIED = mk("unverified", false);
const INDEP = mk("indep");
const ACTORS = [OWNER, ADMIN, MANAGER, OUTSIDER, UNVERIFIED, INDEP];
const IDS = ACTORS.map((a) => a.userId);
const EMAILS = ACTORS.map((a) => a.email);

let categoryId: string;
let orgId: string;
let indepOrgId: string;
let listingId: string;

const tokenOf = (url: string) => url.split("/").pop()!;

async function cleanup() {
  const orgIds = (await db.select({ id: organizations.id }).from(organizations).where(inArray(organizations.ownerUserId, IDS))).map((o) => o.id);
  await db.delete(professionals).where(inArray(professionals.ownerUserId, IDS));
  if (orgIds.length) {
    await db.delete(auditLogs).where(inArray(auditLogs.organizationId, orgIds));
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
  }
  await db.delete(emailOutbox).where(inArray(emailOutbox.toEmail, EMAILS));
  await db.delete(notifications).where(inArray(notifications.userId, IDS));
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, IDS));
  await db.delete(users).where(inArray(users.id, IDS));
}

async function org(owner: Actor, slug: string, agencyStatus: "none" | "pending" | "verified") {
  const [row] = await db.insert(organizations).values({ name: `Itest ${slug}`, slug: `${RUN}-${slug}`, type: "company", ownerUserId: owner.userId, agencyStatus }).returning({ id: organizations.id });
  await db.insert(organizationMembers).values({ organizationId: row!.id, userId: owner.userId, role: "owner", acceptedAt: new Date() });
  return row!.id;
}

async function invited(actor: Actor, invitee: Actor, role: "admin" | "manager") {
  const { url } = await inviteMember(actor, orgId, { email: invitee.email, role });
  return tokenOf(url);
}

async function memberId(actor: Actor) {
  const [m] = await db.select({ id: organizationMembers.id }).from(organizationMembers).where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, actor.userId)));
  return m!.id;
}

async function auditActions() {
  return (await db.select({ action: auditLogs.action }).from(auditLogs).where(eq(auditLogs.organizationId, orgId))).map((r) => r.action);
}

beforeAll(async () => {
  await cleanup();
  for (const a of ACTORS) await db.insert(users).values({ id: a.userId, name: a.name, email: a.email, emailVerified: a.emailVerified, role: a.globalRole });
  const [cat] = await db.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, "decorateur")).limit(1);
  if (!cat) throw new Error("reference data missing: run pnpm db:seed first");
  categoryId = cat.id;
  if (!(await loadAgencyPlan())) throw new Error("agency plan missing: run pnpm db:seed first");
  orgId = await org(OWNER, "agence", "verified");
  indepOrgId = await org(INDEP, "indep", "none");
  const [l] = await db
    .insert(professionals)
    .values({ ownerUserId: OWNER.userId, organizationId: orgId, slug: `${RUN}-fiche`, displayName: "Itest fiche", primaryCategoryId: categoryId, status: "published", publishedAt: new Date(), city: "Lyon", postalCode: "69002", department: "69" })
    .returning({ id: professionals.id });
  listingId = l!.id;
});
afterAll(cleanup);

describe("invitation", () => {
  it("stores only the token hash, e-mails the link and grants nothing before acceptance", async () => {
    const { invitationId, url } = await inviteMember(OWNER, orgId, { email: `  ${MANAGER.email.toUpperCase()} `, role: "manager" });
    const [row] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.id, invitationId));
    expect(row?.email).toBe(MANAGER.email);
    expect(row?.tokenHash).not.toContain(tokenOf(url));
    expect(row?.acceptedAt).toBeNull();
    const mails = await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, MANAGER.email));
    expect(mails).toHaveLength(1);
    expect(mails[0]?.payload).toMatchObject({ url });
    expect(await getProfessionalAccess(MANAGER, listingId)).toBeNull();
    expect((await listMembers(OWNER, orgId)).invitations.map((i) => i.email)).toEqual([MANAGER.email]);
    expect(await auditActions()).toContain("organization.member_invited");
  });

  it("re-inviting the same address replaces the pending link", async () => {
    const first = await invited(OWNER, OUTSIDER, "manager");
    const second = await invited(OWNER, OUTSIDER, "admin");
    expect((await previewOrganizationInvitation(first))?.state).toBe("revoked");
    expect((await previewOrganizationInvitation(second))?.state).toBe("valid");
    const pending = (await listMembers(OWNER, orgId)).invitations.filter((i) => i.email === OUTSIDER.email);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.role).toBe("admin");
    await revokeOrganizationInvitation(OWNER, orgId, pending[0]!.id);
    await expect(acceptOrganizationInvitation(OUTSIDER, second)).rejects.toBeInstanceOf(ConflictError);
    expect(await auditActions()).toContain("organization.invitation_revoked");
  });

  it("refuses the owner's own address and outsiders", async () => {
    await expect(inviteMember(OWNER, orgId, { email: OWNER.email, role: "admin" })).rejects.toBeInstanceOf(ConflictError);
    await expect(inviteMember(OUTSIDER, orgId, { email: "x@sousnosailes.test", role: "admin" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is refused for a structure that is not a verified agency", async () => {
    await expect(inviteMember(INDEP, indepOrgId, { email: OUTSIDER.email, role: "manager" })).rejects.toBeInstanceOf(ConflictError);
    await db.update(organizations).set({ agencyStatus: "pending" }).where(eq(organizations.id, indepOrgId));
    await expect(inviteMember(INDEP, indepOrgId, { email: OUTSIDER.email, role: "manager" })).rejects.toBeInstanceOf(ConflictError);
    await expect(listMembers(INDEP, indepOrgId)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("acceptance", () => {
  it("requires the invited, verified address", async () => {
    const token = await invited(OWNER, UNVERIFIED, "manager");
    await expect(acceptOrganizationInvitation(OUTSIDER, token)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(acceptOrganizationInvitation(UNVERIFIED, token)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await previewOrganizationInvitation(token))?.state).toBe("valid");
  });

  it("creates the accepted membership once, then the link is used", async () => {
    const token = await invited(OWNER, MANAGER, "manager");
    expect(await acceptOrganizationInvitation(MANAGER, token)).toEqual({ organizationId: orgId });
    const [m] = await db.select().from(organizationMembers).where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, MANAGER.userId)));
    expect(m?.role).toBe("manager");
    expect(m?.acceptedAt).toBeInstanceOf(Date);
    expect(m?.invitedByUserId).toBe(OWNER.userId);
    expect((await requireProfessionalManage(MANAGER, listingId)).role).toBe("org_manager");
    expect((await listManagedListings(MANAGER)).map((l) => l.id)).toContain(listingId);
    expect(await listMyAgencies(MANAGER)).toEqual([{ organizationId: orgId, name: "Itest agence", role: "manager", canManageMembers: false }]);
    await expect(acceptOrganizationInvitation(MANAGER, token)).rejects.toBeInstanceOf(ConflictError);
    expect((await previewOrganizationInvitation(token))?.state).toBe("used");
    const notified = await db.select({ title: notifications.title }).from(notifications).where(eq(notifications.userId, OWNER.userId));
    expect(notified.some((n) => n.title.includes("a rejoint l'équipe"))).toBe(true);
    expect(await auditActions()).toContain("organization.member_joined");
  });

  it("rejects an expired link", async () => {
    const token = await invited(OWNER, OUTSIDER, "manager");
    await db.update(organizationInvitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(and(eq(organizationInvitations.organizationId, orgId), eq(organizationInvitations.email, OUTSIDER.email)));
    expect((await previewOrganizationInvitation(token))?.state).toBe("expired");
    await expect(acceptOrganizationInvitation(OUTSIDER, token)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("non-accepted membership", () => {
  it("grants no access anywhere", async () => {
    await db.insert(organizationMembers).values({ organizationId: orgId, userId: OUTSIDER.userId, role: "admin", acceptedAt: null });
    expect(await getProfessionalAccess(OUTSIDER, listingId)).toBeNull();
    await expect(requireProfessionalManage(OUTSIDER, listingId)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listManagedListings(OUTSIDER)).map((l) => l.id)).not.toContain(listingId);
    expect(await listMyAgencies(OUTSIDER)).toEqual([]);
    await expect(listMembers(OUTSIDER, orgId)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listMembers(OWNER, orgId)).members.map((m) => m.userId)).not.toContain(OUTSIDER.userId);
    await db.delete(organizationMembers).where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, OUTSIDER.userId)));
  });
});

describe("roles and removal", () => {
  it("a manager cannot manage the team", async () => {
    await expect(listMembers(MANAGER, orgId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(inviteMember(MANAGER, orgId, { email: OUTSIDER.email, role: "admin" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(changeMemberRole(MANAGER, orgId, await memberId(MANAGER), "admin")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("an admin manages members but never the owner", async () => {
    await acceptOrganizationInvitation(ADMIN, await invited(OWNER, ADMIN, "admin"));
    const team = await listMembers(ADMIN, orgId);
    expect(team.members.map((m) => [m.userId, m.role, m.editable])).toEqual([
      [OWNER.userId, "owner", false],
      [MANAGER.userId, "manager", true],
      [ADMIN.userId, "admin", true],
    ]);
    const ownerMember = await memberId(OWNER);
    await expect(changeMemberRole(ADMIN, orgId, ownerMember, "manager")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(removeMember(ADMIN, orgId, ownerMember)).rejects.toBeInstanceOf(ForbiddenError);

    await changeMemberRole(ADMIN, orgId, await memberId(MANAGER), "admin");
    expect((await requireProfessionalManage(MANAGER, listingId)).role).toBe("org_admin");
    await changeMemberRole(OWNER, orgId, await memberId(MANAGER), "manager");
    const [log] = await db.select({ metadata: auditLogs.metadata }).from(auditLogs).where(and(eq(auditLogs.organizationId, orgId), eq(auditLogs.action, "organization.member_role_changed"), eq(auditLogs.actorUserId, OWNER.userId)));
    expect(log?.metadata).toMatchObject({ from: "admin", to: "manager" });
  });

  it("removal revokes access immediately", async () => {
    await removeMember(OWNER, orgId, await memberId(MANAGER));
    expect(await getProfessionalAccess(MANAGER, listingId)).toBeNull();
    expect(await listMyAgencies(MANAGER)).toEqual([]);
    expect(await auditActions()).toContain("organization.member_removed");
    // A member id from another organisation is invisible.
    const [foreign] = await db.select({ id: organizationMembers.id }).from(organizationMembers).where(eq(organizationMembers.organizationId, indepOrgId));
    await expect(removeMember(OWNER, orgId, foreign!.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("billing stays with the owner", () => {
  it("a member can neither open nor grow the agency subscription", async () => {
    const [draft] = await db
      .insert(professionals)
      .values({ ownerUserId: OWNER.userId, organizationId: orgId, slug: `${RUN}-seconde`, displayName: "Itest seconde", primaryCategoryId: categoryId, status: "draft", city: "Lyon", postalCode: "69002", department: "69" })
      .returning();
    await expect(assertListingSlot(ADMIN.userId, draft!, { confirmExtraCharge: true })).rejects.toBeInstanceOf(ForbiddenError);
    const ownerErr = await assertListingSlot(OWNER.userId, draft!, {}).catch((e: unknown) => e);
    expect(isAppError(ownerErr) && ownerErr.code).toBe("payment_required");
    await expect(startAgencyCheckout(ADMIN, { organizationId: orgId, quantity: 1, professionalId: draft!.id })).rejects.toBeInstanceOf(NotFoundError);
  });
});
