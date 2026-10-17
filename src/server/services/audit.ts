import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export type AuditInput = {
  actorId?: string | null;
  actorRole?: Role | null;
  action: string;
  entityType: string;
  entityId: string;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
};

/** Records a minimal audit trail entry. Never include payloads, tokens or secrets. */
export async function recordAudit(input: AuditInput, tx: Prisma.TransactionClient | typeof db = db): Promise<void> {
  await tx.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: input.metadata,
    },
  });
}

export async function listAuditForEntity(entityType: string, entityId: string, limit = 50) {
  return db.auditEvent.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true, role: true } } },
  });
}
