import { db, type DbExecutor } from "@/db/client";
import { securityEvents } from "@/db/schema";
import { logger } from "@/lib/logger";

export type FileSecurityEventType = "upload_rejected" | "upload_infected" | "file_access_denied" | "upload_rate_limited" | "upload_quota_exceeded";

const SEVERITY: Record<FileSecurityEventType, "info" | "low" | "medium" | "high" | "critical"> = {
  upload_rejected: "low",
  upload_infected: "high",
  file_access_denied: "low",
  upload_rate_limited: "medium",
  upload_quota_exceeded: "info",
};

/** Security events never contain file contents or user supplied names beyond their extension. */
export async function recordFileSecurityEvent(
  type: FileSecurityEventType,
  input: { userId?: string | null; fileId?: string; scope?: string; scopeId?: string; purpose?: string; reason?: string; ipAddress?: string | null; userAgent?: string | null },
  executor: DbExecutor = db,
): Promise<void> {
  try {
    await executor.insert(securityEvents).values({
      type,
      severity: SEVERITY[type],
      userId: input.userId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      details: { fileId: input.fileId, scope: input.scope, scopeId: input.scopeId, purpose: input.purpose, reason: input.reason },
    });
  } catch (err) {
    logger.error({ err, type }, "failed to record security event");
  }
}
