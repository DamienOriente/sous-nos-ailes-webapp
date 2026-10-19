import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { eventDocuments, eventMembers, eventProfessionals, files, professionals, users } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission, type EventAccess } from "@/modules/authorization";
import { recordAudit } from "@/modules/events/application/audit";
import { DOCUMENT_KINDS } from "@/modules/events/domain/document-labels";
import { notify } from "@/modules/notifications/application/notification-service";

export { DOCUMENT_KIND_LABELS, DOCUMENT_KINDS } from "@/modules/events/domain/document-labels";

export const documentSchema = z.object({
  title: z.string().trim().min(2, "Titre trop court.").max(160),
  kind: z.enum(DOCUMENT_KINDS).default("other"),
  fileId: z.uuid("Ajoutez un fichier."),
  /** organizers | team | provider (then eventProfessionalId is required). */
  visibility: z.enum(["organizers", "team", "provider"]).default("organizers"),
  eventProfessionalId: z.uuid().nullable().optional(),
});

export type DocumentRow = {
  id: string;
  title: string;
  kind: string;
  visibility: string;
  eventProfessionalId: string | null;
  providerLabel: string | null;
  fileId: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  fileStatus: string | null;
  uploadedByName: string | null;
  createdAt: Date;
};

/** Organisers see everything; others see team documents + those shared with their own provider slot. */
export async function listDocuments(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<{ access: EventAccess; documents: DocumentRow[] }> {
  const access = await requireEventPermission(actor, eventId, "event.documents.view", executor);
  let filter = eq(eventDocuments.eventId, eventId);
  if (!access.isOrganizer) {
    const mySlots = await executor.select({ id: eventProfessionals.id }).from(eventProfessionals).where(and(eq(eventProfessionals.eventId, eventId), eq(eventProfessionals.memberId, access.memberId)));
    const ids = mySlots.map((s) => s.id);
    filter = and(eq(eventDocuments.eventId, eventId), or(eq(eventDocuments.visibility, "team"), ids.length ? and(eq(eventDocuments.visibility, "provider"), inArray(eventDocuments.eventProfessionalId, ids)) : undefined))!;
  }
  const rows = await executor
    .select({
      d: eventDocuments,
      fileName: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      fileStatus: files.status,
      uploadedByName: users.name,
      providerExternal: eventProfessionals.externalName,
      providerPro: professionals.displayName,
    })
    .from(eventDocuments)
    .leftJoin(files, eq(files.id, eventDocuments.fileId))
    .leftJoin(users, eq(users.id, eventDocuments.uploadedByUserId))
    .leftJoin(eventProfessionals, eq(eventProfessionals.id, eventDocuments.eventProfessionalId))
    .leftJoin(professionals, eq(professionals.id, eventProfessionals.professionalId))
    .where(filter)
    .orderBy(desc(eventDocuments.createdAt));
  return {
    access,
    documents: rows.map((r) => ({
      id: r.d.id,
      title: r.d.title,
      kind: r.d.kind,
      visibility: r.d.visibility,
      eventProfessionalId: r.d.eventProfessionalId,
      providerLabel: r.providerPro ?? r.providerExternal ?? null,
      fileId: r.d.fileId,
      fileName: r.fileName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      fileStatus: r.fileStatus,
      uploadedByName: r.uploadedByName,
      createdAt: r.d.createdAt,
    })),
  };
}

export async function addDocument(actor: Actor, eventId: string, raw: unknown, executor: DbExecutor = db): Promise<{ id: string }> {
  await requireEventPermission(actor, eventId, "event.documents.manage", executor);
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Document invalide.", { issues: parsed.error.issues });
  const d = parsed.data;
  if (d.visibility === "provider" && !d.eventProfessionalId) throw new ValidationError("Choisissez le prestataire avec qui partager ce document.");
  // The file must belong to this event's scope (never reference another tenant's file).
  const [f] = await executor.select({ id: files.id, scope: files.scope, scopeId: files.scopeId, status: files.status }).from(files).where(eq(files.id, d.fileId)).limit(1);
  if (!f || f.scope !== "event" || f.scopeId !== eventId || f.status === "infected" || f.status === "rejected" || f.status === "deleted") throw new ValidationError("Fichier introuvable ou refusé.");
  let slotMemberUserId: string | null = null;
  if (d.eventProfessionalId) {
    const [slot] = await executor.select({ id: eventProfessionals.id, memberId: eventProfessionals.memberId }).from(eventProfessionals).where(and(eq(eventProfessionals.id, d.eventProfessionalId), eq(eventProfessionals.eventId, eventId))).limit(1);
    if (!slot) throw new ValidationError("Prestataire inconnu.");
    if (slot.memberId) {
      const [m] = await executor.select({ userId: eventMembers.userId }).from(eventMembers).where(eq(eventMembers.id, slot.memberId)).limit(1);
      slotMemberUserId = m?.userId ?? null;
    }
  }
  const [row] = await executor
    .insert(eventDocuments)
    .values({ eventId, fileId: d.fileId, title: d.title, kind: d.kind, visibility: d.visibility, eventProfessionalId: d.visibility === "provider" ? d.eventProfessionalId : null, uploadedByUserId: actor.userId })
    .returning({ id: eventDocuments.id });
  if (!row) throw new Error("document insert failed");
  if (slotMemberUserId && slotMemberUserId !== actor.userId) {
    await notify({ userId: slotMemberUserId, type: "document_added", title: "Un document a été partagé avec vous", body: d.title, href: `/app/evenements/${eventId}/documents`, eventId, dedupeKey: `doc:${row.id}` }, executor);
  }
  return row;
}

export async function deleteDocument(actor: Actor, eventId: string, documentId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.documents.manage", executor);
  const [doc] = await executor.select({ id: eventDocuments.id, title: eventDocuments.title }).from(eventDocuments).where(and(eq(eventDocuments.id, documentId), eq(eventDocuments.eventId, eventId))).limit(1);
  if (!doc) throw new NotFoundError();
  await executor.delete(eventDocuments).where(eq(eventDocuments.id, documentId));
  await recordAudit({ actorUserId: actor.userId, action: "event.document.deleted", resourceType: "event_document", resourceId: documentId, eventId, metadata: { title: doc.title } }, executor);
}
