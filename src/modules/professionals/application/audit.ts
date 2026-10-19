import { db, type DbExecutor } from "@/db/client";
import { auditLogs } from "@/db/schema";

export type AuditInput = {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  organizationId?: string | null;
  eventId?: string | null;
  metadata?: Record<string, unknown>;
  reason?: string | null;
};

/** Thin wrapper so every status/permission change in the module is journaled the same way. */
export async function audit(input: AuditInput, executor: DbExecutor = db): Promise<void> {
  await executor.insert(auditLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    organizationId: input.organizationId ?? null,
    eventId: input.eventId ?? null,
    metadata: input.metadata ?? {},
    reason: input.reason ?? null,
  });
}
