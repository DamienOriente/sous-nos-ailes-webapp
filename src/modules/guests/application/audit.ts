import { db, type DbExecutor } from "@/db/client";
import { auditLogs } from "@/db/schema";
import type { Actor } from "@/lib/session";

export type AuditInput = {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  eventId?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, unknown>;
  reason?: string | null;
};

/** Minimal audit writer shared by contacts/guests/invitations/seating. Metadata never contains personal data beyond ids/counts. */
export async function writeAudit(actor: Actor | null, input: AuditInput, executor: DbExecutor = db): Promise<void> {
  await executor.insert(auditLogs).values({
    actorUserId: actor?.userId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    eventId: input.eventId ?? null,
    organizationId: input.organizationId ?? null,
    metadata: input.metadata ?? {},
    reason: input.reason ?? null,
  });
}
