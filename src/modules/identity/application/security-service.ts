import { and, desc, eq, inArray } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { securityEvents, users } from "@/db/schema";
import { logger } from "@/lib/logger";
import { RateLimitedError } from "@/lib/errors";
import { redis } from "@/lib/redis";
import type { Actor } from "@/lib/session";
import { SECURITY_EVENT_TYPES, type SecurityEventType } from "@/modules/identity/domain/security";

export type SecuritySeverity = "info" | "low" | "medium" | "high" | "critical";

export type RecordSecurityEventInput = {
  type: SecurityEventType;
  userId?: string | null;
  severity?: SecuritySeverity;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Minimal, never secrets nor the attempted password. An e-mail is acceptable only as a hash/mask. */
  details?: Record<string, unknown>;
};

const DEFAULT_SEVERITY: Record<SecurityEventType, SecuritySeverity> = {
  login_succeeded: "info",
  login_failed: "low",
  password_changed: "medium",
  password_reset_requested: "low",
  password_reset_completed: "medium",
  two_factor_enabled: "info",
  two_factor_disabled: "medium",
  backup_codes_regenerated: "low",
  session_revoked: "info",
  sessions_revoked_all: "low",
  rate_limited: "medium",
};

/** Validates the IP loosely before storing it in an `inet` column (an invalid value would fail the insert). */
function sanitizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const first = ip.split(",")[0]?.trim() ?? "";
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(first) || /^[0-9a-fA-F:]+$/.test(first)) return first;
  return null;
}

/** Append-only journal. Never throws: a logging failure must not break the auth flow. */
export async function recordSecurityEvent(input: RecordSecurityEventInput, executor: DbExecutor = db): Promise<void> {
  try {
    await executor.insert(securityEvents).values({
      type: input.type,
      severity: input.severity ?? DEFAULT_SEVERITY[input.type],
      userId: input.userId ?? null,
      ipAddress: sanitizeIp(input.ipAddress),
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      details: input.details ?? {},
    });
  } catch (err) {
    logger.error({ err, type: input.type }, "failed to record security event");
  }
}

export type SecurityEventView = {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

/** Recent security events of the current user only (the admin module has its own global view). */
export async function listMySecurityEvents(actor: Actor, limit = 20, executor: DbExecutor = db): Promise<SecurityEventView[]> {
  const rows = await executor
    .select({ id: securityEvents.id, type: securityEvents.type, severity: securityEvents.severity, ipAddress: securityEvents.ipAddress, userAgent: securityEvents.userAgent, createdAt: securityEvents.createdAt })
    .from(securityEvents)
    .where(and(eq(securityEvents.userId, actor.userId), inArray(securityEvents.type, [...SECURITY_EVENT_TYPES])))
    .orderBy(desc(securityEvents.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, type: r.type as SecurityEventType, ipAddress: r.ipAddress ?? null, userAgent: r.userAgent ?? null }));
}

export async function isTwoFactorEnabled(userId: string, executor: DbExecutor = db): Promise<boolean> {
  const [row] = await executor.select({ enabled: users.twoFactorEnabled }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.enabled ?? false;
}

/**
 * Fixed-window counter in Redis for flows that bypass better-auth's HTTP
 * rate limiter (server actions calling auth.api directly). Fails open if
 * Redis is down: availability over strictness for a sign-up form, the
 * failure is logged.
 */
export async function assertRateLimit(key: string, max: number, windowSeconds: number): Promise<void> {
  const redisKey = `rl:identity:${key}`;
  let count: number;
  try {
    count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
  } catch (err) {
    logger.warn({ err, key }, "rate limit storage unavailable, allowing request");
    return;
  }
  if (count > max) {
    await recordSecurityEvent({ type: "rate_limited", details: { key: key.split(":")[0] } });
    throw new RateLimitedError();
  }
}
