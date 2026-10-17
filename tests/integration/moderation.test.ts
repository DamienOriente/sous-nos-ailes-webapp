import { and, eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { db } from "@/db/client";
import { auditLogs, emailOutbox, eventMembers, eventPermissions, events, moderationCases, moderationDecisions, notifications, professionalCategories, professionals, profileVersions, publicProfiles, securityEvents, users } from "@/db/schema";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getEventAccess, requireEventPermission } from "@/modules/authorization";
import { grantBreakGlass, revokeBreakGlass, revokeExpiredBreakGlass } from "@/modules/admin/application/break-glass";
import { setGlobalRole } from "@/modules/admin/application/user-admin";
import { decideCase, decideOnProfessional, getCaseDetail, listCases, openModerationCase, reviewVerification } from "@/modules/moderation/application/moderation-service";

const P = "itest-mod";
const owner: Actor = { userId: `${P}-owner`, email: `${P}-owner@sousnosailes.test`, name: "Itest Owner", globalRole: "user", emailVerified: true, isDemo: false };
const moderator: Actor = { userId: `${P}-moderator`, email: `${P}-moderator@sousnosailes.test`, name: "Itest Moderator", globalRole: "moderator", emailVerified: true, isDemo: false };
const admin: Actor = { userId: `${P}-admin`, email: `${P}-admin@sousnosailes.test`, name: "Itest Admin", globalRole: "admin", emailVerified: true, isDemo: false };
const superAdmin: Actor = { userId: `${P}-super`, email: `${P}-super@sousnosailes.test`, name: "Itest Super", globalRole: "super_admin", emailVerified: true, isDemo: false };

let categoryId: string;
let proA: string;
let proB: string;
let eventId: string;

async function cleanup() {
  const pros = await db.select({ id: professionals.id }).from(professionals).where(like(professionals.slug, `${P}-%`));
  for (const p of pros) {
    await db.delete(moderationCases).where(eq(moderationCases.professionalId, p.id));
    await db.delete(publicProfiles).where(eq(publicProfiles.professionalId, p.id));
  }
  await db.delete(professionals).where(like(professionals.slug, `${P}-%`));
  await db.delete(events).where(eq(events.ownerUserId, owner.userId));
  for (const a of [owner, moderator, admin, superAdmin]) {
    await db.delete(notifications).where(eq(notifications.userId, a.userId));
    await db.delete(emailOutbox).where(eq(emailOutbox.toEmail, a.email));
    await db.delete(auditLogs).where(eq(auditLogs.actorUserId, a.userId));
    await db.delete(securityEvents).where(eq(securityEvents.userId, a.userId));
  }
  await db.delete(users).where(like(users.id, `${P}-%`));
}

async function createPro(suffix: string, status: "pending_review" | "published") {
  const [p] = await db
    .insert(professionals)
    .values({ ownerUserId: owner.userId, slug: `${P}-${suffix}-${Date.now()}`, displayName: `Itest Pro ${suffix}`, primaryCategoryId: categoryId, status, city: "Toulouse", postalCode: "31000", department: "31", isDemo: false })
    .returning({ id: professionals.id });
  const [profile] = await db.insert(publicProfiles).values({ professionalId: p!.id, slug: `${P}-${suffix}-${Date.now()}` }).returning({ id: publicProfiles.id });
  const [v1] = await db.insert(profileVersions).values({ publicProfileId: profile!.id, versionNumber: 1, status: "submitted", templateKey: "minimal-ivoire", submittedAt: new Date() }).returning({ id: profileVersions.id });
  await db.update(publicProfiles).set({ draftVersionId: v1!.id }).where(eq(publicProfiles.id, profile!.id));
  return { id: p!.id, profileId: profile!.id, v1: v1!.id };
}

beforeAll(async () => {
  await cleanup();
  for (const a of [owner, moderator, admin, superAdmin]) await db.insert(users).values({ id: a.userId, name: a.name, email: a.email, emailVerified: true, role: a.globalRole });
  const [cat] = await db.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, "dj")).limit(1);
  categoryId = cat!.id;
  const [ev] = await db.insert(events).values({ ownerUserId: owner.userId, name: "Itest event", type: "other" }).returning({ id: events.id });
  eventId = ev!.id;
  await db.insert(eventMembers).values({ eventId, userId: owner.userId, role: "owner", status: "active" });
});
afterAll(cleanup);

describe("moderation workflow", () => {
  let caseA: string;
  it("queue → approve publishes the listing and its submitted page version, notifies the owner", async () => {
    const a = await createPro("a", "pending_review");
    proA = a.id;
    ({ caseId: caseA } = await openModerationCase({ kind: "profile_review", resourceType: "professional", resourceId: proA, professionalId: proA, openedByUserId: owner.userId, summary: "itest" }));
    const queue = await listCases(moderator, { status: "active" });
    expect(queue.some((c) => c.id === caseA)).toBe(true);
    // Reason must be meaningful.
    await expect(decideCase(moderator, caseA, { decision: "approve", reason: "ok" })).rejects.toBeInstanceOf(ValidationError);
    const res = await decideCase(moderator, caseA, { decision: "approve", reason: "SIRET rapproché de l'avis SIRENE, description conforme, photos adaptées." });
    expect(res.professionalStatus).toBe("published");
    const [pro] = await db.select().from(professionals).where(eq(professionals.id, proA));
    expect(pro?.status).toBe("published");
    expect(pro?.publishedAt).toBeTruthy();
    const [profile] = await db.select().from(publicProfiles).where(eq(publicProfiles.professionalId, proA));
    expect(profile?.publishedVersionId).toBe(a.v1);
    const [v1] = await db.select().from(profileVersions).where(eq(profileVersions.id, a.v1));
    expect(v1?.status).toBe("approved");
    const detail = await getCaseDetail(moderator, caseA);
    expect(detail.case.status).toBe("resolved");
    expect(detail.decisions[0]?.decision).toBe("approve");
    const notif = await db.select().from(notifications).where(and(eq(notifications.userId, owner.userId), eq(notifications.type, "profile_approved")));
    expect(notif.length).toBeGreaterThan(0);
    const audit = await db.select().from(auditLogs).where(and(eq(auditLogs.actorUserId, moderator.userId), eq(auditLogs.action, "moderation.decision.approve")));
    expect(audit.length).toBe(1);
  });

  it("request_changes on a published listing keeps the published version visible", async () => {
    const [profile] = await db.select().from(publicProfiles).where(eq(publicProfiles.professionalId, proA));
    const [v2] = await db.insert(profileVersions).values({ publicProfileId: profile!.id, versionNumber: 2, status: "submitted", templateKey: "minimal-ivoire", submittedAt: new Date() }).returning({ id: profileVersions.id });
    const { caseId } = await openModerationCase({ kind: "profile_update_review", resourceType: "professional", resourceId: proA, professionalId: proA, openedByUserId: owner.userId });
    const res = await decideCase(moderator, caseId, { decision: "request_changes", reason: "La nouvelle description mentionne une certification non justifiée ; merci de la retirer ou de transmettre le justificatif." });
    expect(res.professionalStatus).toBe("changes_requested");
    const [after] = await db.select().from(publicProfiles).where(eq(publicProfiles.id, profile!.id));
    expect(after?.publishedVersionId).toBe((await db.select().from(profileVersions).where(and(eq(profileVersions.publicProfileId, profile!.id), eq(profileVersions.versionNumber, 1))))[0]?.id);
    const [v2after] = await db.select().from(profileVersions).where(eq(profileVersions.id, v2!.id));
    expect(v2after?.status).toBe("rejected");
    const notif = await db.select().from(notifications).where(and(eq(notifications.userId, owner.userId), eq(notifications.type, "changes_requested")));
    expect(notif.length).toBeGreaterThan(0);
    // Back to published for the next steps (moderator transition changes_requested → published).
    await db.update(professionals).set({ status: "published" }).where(eq(professionals.id, proA));
  });

  it("reject sets the listing to rejected with the motivated decision", async () => {
    const b = await createPro("b", "pending_review");
    proB = b.id;
    const { caseId } = await openModerationCase({ kind: "profile_review", resourceType: "professional", resourceId: proB, professionalId: proB });
    await decideCase(moderator, caseId, { decision: "reject", reason: "Activité hors périmètre de la plateforme (vente de matériel sans prestation)." });
    const [pro] = await db.select().from(professionals).where(eq(professionals.id, proB));
    expect(pro?.status).toBe("rejected");
    const decisions = await db.select().from(moderationDecisions).where(eq(moderationDecisions.caseId, caseId));
    expect(decisions.map((d) => d.decision)).toEqual(["reject"]);
    const notif = await db.select().from(notifications).where(and(eq(notifications.userId, owner.userId), eq(notifications.type, "profile_rejected")));
    expect(notif.length).toBeGreaterThan(0);
  });

  it("suspend then reinstate through direct decisions", async () => {
    await decideOnProfessional(moderator, proA, { decision: "suspend", reason: "Signalement confirmé : coordonnées renvoyant vers un site frauduleux." });
    expect((await db.select().from(professionals).where(eq(professionals.id, proA)))[0]?.status).toBe("suspended");
    await decideOnProfessional(moderator, proA, { decision: "reinstate", reason: "Coordonnées corrigées et vérifiées par appel téléphonique le jour même." });
    expect((await db.select().from(professionals).where(eq(professionals.id, proA)))[0]?.status).toBe("published");
  });

  it("verifications require a precise statement and recompute the level", async () => {
    await expect(reviewVerification(moderator, proA, "business_registration_checked", "verified", "ok")).rejects.toBeInstanceOf(ValidationError);
    await reviewVerification(moderator, proA, "identity_declared", "verified", "Identité et coordonnées renseignées et cohérentes avec le Kbis.");
    await reviewVerification(moderator, proA, "business_registration_checked", "verified", "SIRET rapproché de l'avis de situation SIRENE daté du 12/09/2026.");
    const [pro] = await db.select({ level: professionals.verificationLevel }).from(professionals).where(eq(professionals.id, proA));
    expect(pro?.level).toBe(2);
  });

  it("a moderator cannot change global roles; an admin cannot promote to super_admin", async () => {
    await expect(setGlobalRole(moderator, owner.userId, "moderator", "itest attempt")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setGlobalRole(admin, owner.userId, "moderator", "itest attempt")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setGlobalRole(superAdmin, owner.userId, "super_admin", "itest attempt")).rejects.toBeInstanceOf(ForbiddenError);
    await setGlobalRole(superAdmin, owner.userId, "moderator", "itest promotion");
    expect((await db.select({ role: users.role }).from(users).where(eq(users.id, owner.userId)))[0]?.role).toBe("moderator");
    await setGlobalRole(superAdmin, owner.userId, "user", "itest rollback");
  });

  it("an admin has no access to event children data; break-glass grants it temporarily and is revocable", async () => {
    expect(await getEventAccess(admin, eventId)).toBeNull();
    await expect(requireEventPermission(admin, eventId, "children.view_sensitive")).rejects.toBeInstanceOf(NotFoundError);
    await expect(grantBreakGlass(admin, { eventId, legalReason: "Réquisition judiciaire fictive pour test d'intégration.", grants: ["children.view_sensitive"], durationMinutes: 30 })).rejects.toBeInstanceOf(ForbiddenError);
    const { memberId } = await grantBreakGlass(superAdmin, { eventId, legalReason: "Réquisition judiciaire fictive pour test d'intégration.", grants: ["children.view_sensitive"], durationMinutes: 30 });
    const access = await getEventAccess(superAdmin, eventId);
    expect(access?.permissions.has("children.view_sensitive")).toBe(true);
    expect(access?.permissions.has("event.tasks.manage")).toBe(false); // collaborator default denied
    const ownerNotif = await db.select().from(notifications).where(and(eq(notifications.userId, owner.userId), eq(notifications.type, "permission_changed")));
    expect(ownerNotif.length).toBe(1);
    // Expired grants → automatic revocation of the member.
    await db.update(eventPermissions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(eventPermissions.memberId, memberId));
    expect(await getEventAccess(superAdmin, eventId).then((a) => a?.permissions.has("children.view_sensitive"))).toBe(false);
    const { revoked } = await revokeExpiredBreakGlass();
    expect(revoked).toBeGreaterThanOrEqual(1);
    expect(await getEventAccess(superAdmin, eventId)).toBeNull();
    await expect(revokeBreakGlass(superAdmin, memberId)).resolves.toBeUndefined();
  });
});
