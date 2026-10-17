import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { auditLogs, securityEvents, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { recordAudit } from "@/modules/admin/application/audit";

export type SecuritySeverity = "info" | "low" | "medium" | "high" | "critical";

export type SecurityEventInput = {
  type: string;
  severity?: SecuritySeverity;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
};

/** Never throws: a failing security log must not break the request that detected the problem. */
export async function recordSecurityEvent(input: SecurityEventInput, executor: DbExecutor = db): Promise<void> {
  try {
    await executor.insert(securityEvents).values({
      type: input.type,
      severity: input.severity ?? "info",
      userId: input.userId ?? null,
      ipAddress: input.ipAddress && /^[0-9a-fA-F.:]+$/.test(input.ipAddress) ? input.ipAddress : null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      details: input.details ?? {},
    });
  } catch (err) {
    logger.error({ err, type: input.type }, "failed to record security event");
  }
}

export type AuditFilter = { actorUserId?: string; action?: string; resourceType?: string; resourceId?: string; from?: Date; to?: Date; limit?: number };

export async function listAuditLogs(actor: Actor, filter: AuditFilter = {}) {
  requireGlobalPermission(actor, "admin.security.view");
  const conds = [];
  if (filter.actorUserId) conds.push(eq(auditLogs.actorUserId, filter.actorUserId));
  if (filter.action) conds.push(sql`${auditLogs.action} ilike ${`%${filter.action}%`}`);
  if (filter.resourceType) conds.push(eq(auditLogs.resourceType, filter.resourceType));
  if (filter.resourceId) conds.push(eq(auditLogs.resourceId, filter.resourceId));
  if (filter.from) conds.push(gte(auditLogs.createdAt, filter.from));
  if (filter.to) conds.push(lte(auditLogs.createdAt, filter.to));
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      eventId: auditLogs.eventId,
      reason: auditLogs.reason,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actorUserId: auditLogs.actorUserId,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(filter.limit ?? 200, 2000));
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function exportAuditLogsCsv(actor: Actor, filter: AuditFilter = {}): Promise<string> {
  const rows = await listAuditLogs(actor, { ...filter, limit: 2000 });
  await recordAudit(db, { actorUserId: actor.userId, action: "admin.audit.exported", resourceType: "audit_logs", metadata: { rows: rows.length } });
  const header = ["date", "acteur", "action", "type_ressource", "id_ressource", "evenement", "motif", "metadata"];
  const lines = rows.map((r) => [r.createdAt.toISOString(), r.actorEmail ?? r.actorUserId ?? "", r.action, r.resourceType, r.resourceId ?? "", r.eventId ?? "", r.reason ?? "", r.metadata].map(csvCell).join(";"));
  return [header.join(";"), ...lines].join("\r\n");
}

export async function listSecurityEvents(actor: Actor, opts: { minSeverity?: SecuritySeverity; limit?: number } = {}) {
  requireGlobalPermission(actor, "admin.security.view");
  const order: SecuritySeverity[] = ["info", "low", "medium", "high", "critical"];
  const min = opts.minSeverity ? order.indexOf(opts.minSeverity) : 0;
  const allowed = order.slice(min);
  return db
    .select({ id: securityEvents.id, type: securityEvents.type, severity: securityEvents.severity, userId: securityEvents.userId, userEmail: users.email, ipAddress: securityEvents.ipAddress, details: securityEvents.details, createdAt: securityEvents.createdAt })
    .from(securityEvents)
    .leftJoin(users, eq(users.id, securityEvents.userId))
    .where(sql`${securityEvents.severity} in (${sql.join(allowed.map((s) => sql`${s}`), sql`, `)})`)
    .orderBy(desc(securityEvents.createdAt))
    .limit(opts.limit ?? 100);
}

/**
 * Sessions live in Redis (better-auth secondaryStorage): the `sessions` table
 * stays empty, so everything goes through the admin plugin API, which needs the
 * caller's request headers. Tokens never leave the server: rows expose ids only
 * and revocation resolves the token server side.
 */
export type AdminSessionRow = { id: string; userId: string; userEmail: string; userRole: string; ipAddress: string | null; userAgent: string | null; createdAt: Date; expiresAt: Date; impersonatedBy: string | null };

type ApiSession = { id: string; token: string; userId: string; createdAt: Date; expiresAt: Date; ipAddress?: string | null; userAgent?: string | null; impersonatedBy?: string | null };

async function listUserSessionsRaw(userId: string, headers: Headers): Promise<ApiSession[]> {
  try {
    const res = (await auth.api.listUserSessions({ body: { userId }, headers })) as { sessions?: ApiSession[] };
    return res.sessions ?? [];
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err), userId }, "listUserSessions failed");
    return [];
  }
}

export async function listSessionsForUser(actor: Actor, userId: string, headers: Headers): Promise<AdminSessionRow[]> {
  requireGlobalPermission(actor, "admin.users.view");
  const [u] = await db.select({ email: users.email, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return [];
  const now = Date.now();
  return (await listUserSessionsRaw(userId, headers))
    .filter((s) => new Date(s.expiresAt).getTime() > now)
    .map((s) => ({ id: s.id, userId, userEmail: u.email, userRole: u.role, ipAddress: s.ipAddress ?? null, userAgent: s.userAgent ?? null, createdAt: new Date(s.createdAt), expiresAt: new Date(s.expiresAt), impersonatedBy: s.impersonatedBy ?? null }));
}

/**
 * Platform-wide view: privileged accounts + accounts seen in the last 7 days
 * (bounded), since the API only lists sessions per user.
 */
export async function listActiveSessions(actor: Actor, headers: Headers, opts: { maxUsers?: number } = {}): Promise<AdminSessionRow[]> {
  requireGlobalPermission(actor, "admin.security.view");
  const since = new Date(Date.now() - 7 * 86_400_000);
  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.role} <> 'user' or ${users.lastLoginAt} >= ${since} or ${users.updatedAt} >= ${since}`)
    .orderBy(desc(users.updatedAt))
    .limit(opts.maxUsers ?? 60);
  const rows = await Promise.all(candidates.map((c) => listSessionsForUser(actor, c.id, headers)));
  return rows.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Revokes one session of a user by id (token resolved server side). Audited. */
export async function revokeSession(actor: Actor, userId: string, sessionId: string, reason: string, headers: Headers): Promise<void> {
  requireGlobalPermission(actor, "admin.users.manage");
  const target = (await listUserSessionsRaw(userId, headers)).find((s) => s.id === sessionId);
  if (!target) return;
  await auth.api.revokeUserSession({ body: { sessionToken: target.token }, headers });
  await recordAudit(db, { actorUserId: actor.userId, action: "admin.session.revoked", resourceType: "session", resourceId: sessionId, metadata: { userId }, reason });
}
