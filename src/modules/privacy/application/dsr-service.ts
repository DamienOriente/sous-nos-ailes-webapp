import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { auditLogs, dataSubjectRequests, users } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { notify } from "@/modules/notifications/application/notification-service";
import { computeDueAt, DSR_KIND_LABELS, SELF_SERVICE_KINDS, type DsrKind, type DsrStatus } from "@/modules/privacy/domain/dsr";

/**
 * Data subject requests. Users file them from their account; staff with
 * `admin.users.manage` process them. Nothing is deleted automatically: erasure
 * is a human decision because legal obligations (billing, disputes) may apply.
 */
export type CreateDsrInput = { kind: DsrKind; details?: string | null };

export async function createDataSubjectRequest(actor: Actor, input: CreateDsrInput, executor: DbExecutor = db) {
  if (!SELF_SERVICE_KINDS.includes(input.kind)) throw new ValidationError("Ce type de demande n'est pas disponible en ligne.");
  const [open] = await executor
    .select({ id: dataSubjectRequests.id })
    .from(dataSubjectRequests)
    .where(and(eq(dataSubjectRequests.userId, actor.userId), eq(dataSubjectRequests.kind, input.kind), inArray(dataSubjectRequests.status, ["received", "in_progress"])))
    .limit(1);
  if (open) throw new ConflictError(`Une demande « ${DSR_KIND_LABELS[input.kind]} » est déjà en cours de traitement.`);

  const now = new Date();
  const [row] = await executor
    .insert(dataSubjectRequests)
    .values({ userId: actor.userId, email: actor.email, kind: input.kind, details: input.details?.trim() || null, dueAt: computeDueAt(now) })
    .returning({ id: dataSubjectRequests.id, dueAt: dataSubjectRequests.dueAt });
  if (!row) throw new Error("dsr insert failed");
  await executor.insert(auditLogs).values({
    actorUserId: actor.userId,
    action: "privacy.dsr.created",
    resourceType: "data_subject_request",
    resourceId: row.id,
    metadata: { kind: input.kind },
  });
  await notify(
    {
      userId: actor.userId,
      type: "system",
      title: `Demande reçue : ${DSR_KIND_LABELS[input.kind]}`,
      body: `Nous la traitons sous 30 jours. Vous serez informé de chaque étape.`,
      href: "/app/compte/confidentialite",
      dedupeKey: `dsr:${row.id}`,
    },
    executor,
  );
  return row;
}

export async function listMyDataSubjectRequests(actor: Actor, executor: DbExecutor = db) {
  return executor
    .select({
      id: dataSubjectRequests.id,
      kind: dataSubjectRequests.kind,
      status: dataSubjectRequests.status,
      details: dataSubjectRequests.details,
      dueAt: dataSubjectRequests.dueAt,
      completedAt: dataSubjectRequests.completedAt,
      createdAt: dataSubjectRequests.createdAt,
    })
    .from(dataSubjectRequests)
    .where(eq(dataSubjectRequests.userId, actor.userId))
    .orderBy(desc(dataSubjectRequests.createdAt));
}

/** Automatic request filed by retention for inactive accounts (no actor, system origin). */
export async function createSystemErasureRequest(user: { id: string; email: string }, reason: string, executor: DbExecutor = db): Promise<boolean> {
  const [open] = await executor
    .select({ id: dataSubjectRequests.id })
    .from(dataSubjectRequests)
    .where(and(eq(dataSubjectRequests.userId, user.id), eq(dataSubjectRequests.kind, "erasure"), inArray(dataSubjectRequests.status, ["received", "in_progress"])))
    .limit(1);
  if (open) return false;
  await executor.insert(dataSubjectRequests).values({ userId: user.id, email: user.email, kind: "erasure", details: reason, dueAt: computeDueAt(new Date()) });
  return true;
}

// ── Staff side ──────────────────────────────────────────────────────────────
export type DsrListFilter = { status?: DsrStatus | "open" };

export async function listDataSubjectRequests(actor: Actor, filter: DsrListFilter = {}, executor: DbExecutor = db) {
  requireGlobalPermission(actor, "admin.users.manage");
  const where = filter.status === "open" ? inArray(dataSubjectRequests.status, ["received", "in_progress"]) : filter.status ? eq(dataSubjectRequests.status, filter.status) : undefined;
  return executor
    .select({
      id: dataSubjectRequests.id,
      email: dataSubjectRequests.email,
      userId: dataSubjectRequests.userId,
      userName: users.name,
      kind: dataSubjectRequests.kind,
      status: dataSubjectRequests.status,
      details: dataSubjectRequests.details,
      dueAt: dataSubjectRequests.dueAt,
      completedAt: dataSubjectRequests.completedAt,
      handledByUserId: dataSubjectRequests.handledByUserId,
      exportFileId: dataSubjectRequests.exportFileId,
      createdAt: dataSubjectRequests.createdAt,
    })
    .from(dataSubjectRequests)
    .leftJoin(users, eq(users.id, dataSubjectRequests.userId))
    .where(where)
    .orderBy(asc(dataSubjectRequests.dueAt))
    .limit(500);
}

export async function getDataSubjectRequest(actor: Actor, id: string, executor: DbExecutor = db) {
  requireGlobalPermission(actor, "admin.users.manage");
  const [row] = await executor
    .select({
      id: dataSubjectRequests.id,
      email: dataSubjectRequests.email,
      userId: dataSubjectRequests.userId,
      userName: users.name,
      kind: dataSubjectRequests.kind,
      status: dataSubjectRequests.status,
      details: dataSubjectRequests.details,
      dueAt: dataSubjectRequests.dueAt,
      completedAt: dataSubjectRequests.completedAt,
      handledByUserId: dataSubjectRequests.handledByUserId,
      createdAt: dataSubjectRequests.createdAt,
      updatedAt: dataSubjectRequests.updatedAt,
    })
    .from(dataSubjectRequests)
    .leftJoin(users, eq(users.id, dataSubjectRequests.userId))
    .where(eq(dataSubjectRequests.id, id))
    .limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

const TRANSITIONS: Record<DsrStatus, readonly DsrStatus[]> = {
  received: ["in_progress", "completed", "rejected"],
  in_progress: ["completed", "rejected", "received"],
  completed: [],
  rejected: ["received"],
};

export async function updateDataSubjectRequestStatus(actor: Actor, id: string, status: DsrStatus, reason: string | null, executor: DbExecutor = db) {
  requireGlobalPermission(actor, "admin.users.manage");
  const [current] = await executor.select({ status: dataSubjectRequests.status, userId: dataSubjectRequests.userId, kind: dataSubjectRequests.kind }).from(dataSubjectRequests).where(eq(dataSubjectRequests.id, id)).limit(1);
  if (!current) throw new NotFoundError();
  if (!TRANSITIONS[current.status].includes(status)) throw new ConflictError(`Passage de « ${current.status} » à « ${status} » impossible.`);
  if ((status === "rejected" || status === "completed") && !reason?.trim()) throw new ValidationError("Indiquez le motif ou le résumé du traitement.");

  await executor
    .update(dataSubjectRequests)
    .set({ status, handledByUserId: actor.userId, completedAt: status === "completed" ? new Date() : null })
    .where(eq(dataSubjectRequests.id, id));
  await executor.insert(auditLogs).values({
    actorUserId: actor.userId,
    action: "privacy.dsr.status_changed",
    resourceType: "data_subject_request",
    resourceId: id,
    metadata: { from: current.status, to: status, kind: current.kind },
    reason: reason?.trim() || null,
  });
  if (current.userId && (status === "completed" || status === "rejected")) {
    await notify(
      {
        userId: current.userId,
        type: "system",
        title: status === "completed" ? `Votre demande « ${DSR_KIND_LABELS[current.kind]} » a été traitée` : `Votre demande « ${DSR_KIND_LABELS[current.kind]} » n'a pas pu être acceptée`,
        body: reason?.trim() || undefined,
        href: "/app/compte/confidentialite",
        email: "always",
      },
      executor,
    );
  }
}
