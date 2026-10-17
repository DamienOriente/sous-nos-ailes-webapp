import { and, asc, desc, eq } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalDocuments, professionalVerifications } from "@/db/schema";
import type { Actor } from "@/lib/session";
import { requireProfessionalManage } from "@/modules/authorization";
import { ValidationError } from "@/lib/errors";
import { VERIFICATION_KIND_LABELS, VERIFICATION_KINDS, type DocumentKind, type VerificationKind } from "@/modules/professionals/domain/verification";
import { audit } from "./audit";
import { recomputeDerived } from "./professional-service";

/**
 * What the professional sees: every verification kind with its status and
 * meaning. Internal review notes of documents are never returned here.
 */
export async function getVerificationOverview(actor: Actor, professionalId: string, executor: DbExecutor = db) {
  await requireProfessionalManage(actor, professionalId, executor);
  const rows = await executor.select().from(professionalVerifications).where(eq(professionalVerifications.professionalId, professionalId));
  const docs = await executor
    .select({ id: professionalDocuments.id, fileId: professionalDocuments.fileId, kind: professionalDocuments.kind, label: professionalDocuments.label, status: professionalDocuments.status, createdAt: professionalDocuments.createdAt, reviewedAt: professionalDocuments.reviewedAt })
    .from(professionalDocuments)
    .where(eq(professionalDocuments.professionalId, professionalId))
    .orderBy(desc(professionalDocuments.createdAt));
  const kinds = VERIFICATION_KINDS.map((kind) => {
    const row = rows.find((r) => r.kind === kind);
    const meta = VERIFICATION_KIND_LABELS[kind];
    return {
      kind,
      label: meta.label,
      meaning: meta.meaning,
      documentKind: meta.documentKind,
      status: row?.status ?? null,
      statement: row?.statement ?? null,
      reviewedAt: row?.reviewedAt ?? null,
      validUntil: row?.validUntil ?? null,
    };
  });
  return { kinds, documents: docs };
}

const DECLARABLE: readonly VerificationKind[] = ["insurance_declared", "qualification_declared"];

/** The professional declares a fact (insurance, qualification) → pending row until a moderator reviews it. */
export async function declareVerification(actor: Actor, professionalId: string, kind: VerificationKind, statement: string, executor: DbExecutor = db): Promise<void> {
  if (!DECLARABLE.includes(kind)) throw new ValidationError("Cette vérification ne peut pas être déclarée par le professionnel.");
  await requireProfessionalManage(actor, professionalId, executor);
  await executor
    .insert(professionalVerifications)
    .values({ professionalId, kind, status: "pending", statement: statement.slice(0, 500) })
    .onConflictDoUpdate({ target: [professionalVerifications.professionalId, professionalVerifications.kind], set: { status: "pending", statement: statement.slice(0, 500), reviewedAt: null, reviewedByUserId: null } });
  await audit({ actorUserId: actor.userId, action: "professional.verification_declared", resourceType: "professional", resourceId: professionalId, metadata: { kind } }, executor);
}

/** Records an uploaded supporting document (the file itself went through the files module). */
export async function attachDocument(actor: Actor, professionalId: string, input: { fileId: string; kind: DocumentKind; label?: string }, executor: DbExecutor = db): Promise<{ id: string }> {
  await requireProfessionalManage(actor, professionalId, executor);
  const [row] = await executor
    .insert(professionalDocuments)
    .values({ professionalId, fileId: input.fileId, kind: input.kind, label: input.label?.slice(0, 120) ?? null })
    .returning({ id: professionalDocuments.id });
  if (!row) throw new Error("insert failed");
  await audit({ actorUserId: actor.userId, action: "professional.document_added", resourceType: "professional", resourceId: professionalId, metadata: { kind: input.kind, documentId: row.id } }, executor);
  return { id: row.id };
}

export async function removeDocument(actor: Actor, professionalId: string, documentId: string, executor: DbExecutor = db): Promise<void> {
  await requireProfessionalManage(actor, professionalId, executor);
  await executor.delete(professionalDocuments).where(and(eq(professionalDocuments.id, documentId), eq(professionalDocuments.professionalId, professionalId), eq(professionalDocuments.status, "pending")));
}

/** Moderator-side helper used by the admin module and by seeds: record what was verified. */
export async function setVerification(
  professionalId: string,
  kind: VerificationKind,
  status: "verified" | "rejected" | "expired",
  statement: string,
  reviewedByUserId: string | null,
  validUntil: Date | null = null,
  executor: DbExecutor = db,
): Promise<void> {
  await executor
    .insert(professionalVerifications)
    .values({ professionalId, kind, status, statement, reviewedByUserId, reviewedAt: new Date(), validUntil })
    .onConflictDoUpdate({ target: [professionalVerifications.professionalId, professionalVerifications.kind], set: { status, statement, reviewedByUserId, reviewedAt: new Date(), validUntil } });
  await recomputeDerived(professionalId, executor);
}

export const VERIFICATION_ORDER = asc(professionalVerifications.kind);
