import { db, type DbExecutor } from "@/db/client";
import { auditLogs } from "@/db/schema";

export type AuditInput = {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  eventId?: string | null;
  organizationId?: string | null;
  /** Minimal: ids, statuses, counts. Never personal data, secrets, health data or document contents. */
  metadata?: Record<string, unknown>;
  reason?: string | null;
};

export async function recordAudit(executor: DbExecutor = db, input: AuditInput): Promise<void> {
  await executor.insert(auditLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    eventId: input.eventId ?? null,
    organizationId: input.organizationId ?? null,
    metadata: input.metadata ?? {},
    reason: input.reason ?? null,
  });
}
