import { db, type DbExecutor } from "@/db/client";
import { auditLogs } from "@/db/schema";

export type AuditInput = {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  eventId?: string | null;
  metadata?: Record<string, unknown>;
  reason?: string | null;
};

/** Append-only trail for rights, status and deletion changes. Metadata stays minimal (ids, labels — never documents or health data). */
export async function recordAudit(input: AuditInput, executor: DbExecutor = db): Promise<void> {
  await executor.insert(auditLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    eventId: input.eventId ?? null,
    metadata: input.metadata ?? {},
    reason: input.reason ?? null,
  });
}
