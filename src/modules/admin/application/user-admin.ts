import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { appeals, auditLogs, eventMembers, events, moderationCases, moderationDecisions, professionals, twoFactors, userProfiles, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor, GlobalRole } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { recordAudit } from "@/modules/admin/application/audit";
import { listSessionsForUser, recordSecurityEvent, type AdminSessionRow } from "@/modules/admin/application/security-service";

/**
 * User administration. Suspension goes through better-auth's admin plugin
 * (ban + session revocation) when a request context is available; the direct
 * DB path exists for scripts/tests only and produces the same state.
 */
export type UserSearchResult = { id: string; name: string; email: string; role: string; banned: boolean; banExpires: Date | null; twoFactorEnabled: boolean; emailVerified: boolean; isDemo: boolean; createdAt: Date; lastLoginAt: Date | null };

export async function searchUsers(actor: Actor, query: string, opts: { role?: string; banned?: boolean; limit?: number } = {}): Promise<UserSearchResult[]> {
  requireGlobalPermission(actor, "admin.users.view");
  const q = query.trim();
  const conds = [];
  if (q) conds.push(or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`)));
  if (opts.role) conds.push(eq(users.role, opts.role));
  if (opts.banned !== undefined) conds.push(eq(users.banned, opts.banned));
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, banned: users.banned, banExpires: users.banExpires, twoFactorEnabled: users.twoFactorEnabled, emailVerified: users.emailVerified, isDemo: users.isDemo, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(opts.limit ?? 100);
}

export async function getUserDetail(actor: Actor, userId: string, ctx: { headers?: Headers } = {}) {
  requireGlobalPermission(actor, "admin.users.view");
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw new NotFoundError();
  const [profile] = await db.select({ city: userProfiles.city, primaryIntent: userProfiles.primaryIntent, onboardingCompletedAt: userProfiles.onboardingCompletedAt }).from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  const [twoFactor] = await db.select({ verified: twoFactors.verified }).from(twoFactors).where(eq(twoFactors.userId, userId)).limit(1);
  // Sessions are in Redis (better-auth secondaryStorage): read through the admin API when a request context exists.
  const activeSessions: AdminSessionRow[] = ctx.headers ? await listSessionsForUser(actor, userId, ctx.headers) : [];
  const listings = await db.select({ id: professionals.id, displayName: professionals.displayName, status: professionals.status, slug: professionals.slug }).from(professionals).where(and(eq(professionals.ownerUserId, userId), isNull(professionals.deletedAt)));
  // Events: names only (no guests, children or messages — out of scope for administrators).
  const memberOf = await db
    .select({ id: events.id, name: events.name, role: eventMembers.role, status: events.status })
    .from(eventMembers)
    .innerJoin(events, eq(events.id, eventMembers.eventId))
    .where(and(eq(eventMembers.userId, userId), eq(eventMembers.status, "active"), isNull(events.deletedAt)))
    .orderBy(asc(events.name));
  const audit = await db.select().from(auditLogs).where(or(eq(auditLogs.actorUserId, userId), and(eq(auditLogs.resourceType, "user"), eq(auditLogs.resourceId, userId)))).orderBy(desc(auditLogs.createdAt)).limit(50);
  const proIds = listings.map((l) => l.id);
  const moderation = proIds.length
    ? await db
        .select({ caseId: moderationCases.id, kind: moderationCases.kind, status: moderationCases.status, professionalId: moderationCases.professionalId, decision: moderationDecisions.decision, reason: moderationDecisions.reason, decidedAt: moderationDecisions.createdAt })
        .from(moderationCases)
        .leftJoin(moderationDecisions, eq(moderationDecisions.caseId, moderationCases.id))
        .where(inArray(moderationCases.professionalId, proIds))
        .orderBy(desc(moderationCases.createdAt))
        .limit(50)
    : [];
  const userAppeals = await db.select().from(appeals).where(eq(appeals.appellantUserId, userId)).orderBy(desc(appeals.createdAt));
  return { user: u, profile: profile ?? null, twoFactorVerified: twoFactor?.verified ?? false, sessions: activeSessions, listings, events: memberOf, audit, moderation, appeals: userAppeals };
}

export type SuspendInput = { userId: string; reason: string; durationDays?: number | null };

export async function suspendUser(actor: Actor, input: SuspendInput, ctx: { headers?: Headers } = {}): Promise<void> {
  requireGlobalPermission(actor, "admin.users.manage");
  if (input.reason.trim().length < 10) throw new ValidationError("Motivez la suspension (10 caractères minimum).");
  if (input.userId === actor.userId) throw new ConflictError("Vous ne pouvez pas suspendre votre propre compte.");
  const [target] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!target) throw new NotFoundError();
  if (target.role === "super_admin" && actor.globalRole !== "super_admin") throw new ForbiddenError("Seul un super administrateur peut suspendre un super administrateur.");
  const seconds = input.durationDays && input.durationDays > 0 ? input.durationDays * 86_400 : undefined;
  if (ctx.headers) {
    await auth.api.banUser({ body: { userId: input.userId, banReason: input.reason.trim(), banExpiresIn: seconds }, headers: ctx.headers });
  } else {
    // Script/test path: same end state; live sessions (Redis) are revoked by better-auth on the next request of a banned user.
    await db.update(users).set({ banned: true, banReason: input.reason.trim(), banExpires: seconds ? new Date(Date.now() + seconds * 1000) : null }).where(eq(users.id, input.userId));
  }
  await recordAudit(db, { actorUserId: actor.userId, action: "admin.user.suspended", resourceType: "user", resourceId: input.userId, metadata: { durationDays: input.durationDays ?? null }, reason: input.reason.trim() });
  await recordSecurityEvent({ type: "user_suspended", severity: "medium", userId: input.userId, details: { by: actor.userId } });
}

export async function reactivateUser(actor: Actor, userId: string, reason: string, ctx: { headers?: Headers } = {}): Promise<void> {
  requireGlobalPermission(actor, "admin.users.manage");
  if (reason.trim().length < 5) throw new ValidationError("Indiquez un motif.");
  if (ctx.headers) await auth.api.unbanUser({ body: { userId }, headers: ctx.headers });
  else await db.update(users).set({ banned: false, banReason: null, banExpires: null }).where(eq(users.id, userId));
  await recordAudit(db, { actorUserId: actor.userId, action: "admin.user.reactivated", resourceType: "user", resourceId: userId, reason: reason.trim() });
}

const ROLES: GlobalRole[] = ["user", "moderator", "admin", "super_admin"];

/**
 * Global role changes: super_admin only (`admin.roles.manage`). Nobody can be
 * promoted to super_admin from the UI (done by the operator in the database on
 * purpose), and the last super_admin can never be demoted.
 */
export async function setGlobalRole(actor: Actor, userId: string, role: GlobalRole, reason: string, ctx: { headers?: Headers } = {}, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "admin.roles.manage");
  if (!ROLES.includes(role)) throw new ValidationError("Rôle inconnu.");
  if (reason.trim().length < 5) throw new ValidationError("Indiquez un motif.");
  if (role === "super_admin") throw new ForbiddenError("La promotion en super administrateur ne se fait pas depuis l'interface.");
  const [target] = await executor.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new NotFoundError();
  if (target.role === role) return;
  if (target.role === "super_admin") {
    const [{ n }] = (await executor.select({ n: count() }).from(users).where(eq(users.role, "super_admin"))) as [{ n: number }];
    if (n <= 1) throw new ConflictError("Impossible de rétrograder le dernier super administrateur.");
  }
  if (ctx.headers) await auth.api.setRole({ body: { userId, role }, headers: ctx.headers });
  else await executor.update(users).set({ role }).where(eq(users.id, userId));
  await recordAudit(executor, { actorUserId: actor.userId, action: "admin.user.role_changed", resourceType: "user", resourceId: userId, metadata: { from: target.role, to: role }, reason: reason.trim() });
  await recordSecurityEvent({ type: "role_changed", severity: "high", userId, details: { from: target.role, to: role, by: actor.userId } }, executor);
}

export async function revokeUserSessions(actor: Actor, userId: string, reason: string, headers: Headers): Promise<void> {
  requireGlobalPermission(actor, "admin.users.manage");
  await auth.api.revokeUserSessions({ body: { userId }, headers });
  await recordAudit(db, { actorUserId: actor.userId, action: "admin.user.sessions_revoked", resourceType: "user", resourceId: userId, reason });
}

export async function hasTwoFactorEnabled(userId: string): Promise<boolean> {
  const [u] = await db.select({ enabled: users.twoFactorEnabled }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.enabled ?? false;
}

export async function countUsersByRole(executor: DbExecutor = db): Promise<Array<{ role: string; n: number }>> {
  return executor.select({ role: users.role, n: sql<number>`count(*)::int` }).from(users).groupBy(users.role);
}
