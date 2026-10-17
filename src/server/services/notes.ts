import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { normalizeText } from "@/lib/sanitize";
import { recordAudit } from "@/server/services/audit";
import { DomainError } from "@/server/errors";

type Target = { eventId?: string; venueId?: string; providerId?: string };

/** Internal notes are only ever read in Marie's space. */
export async function addInternalNote(target: Target, body: string, actor: SessionUser): Promise<void> {
  const text = normalizeText(body);
  if (!text) throw new DomainError("La note est vide.");
  if (!target.eventId && !target.venueId && !target.providerId) throw new DomainError("Cible de note manquante.");
  await db.$transaction(async (tx) => {
    const note = await tx.internalNote.create({ data: { ...target, authorId: actor.id, body: text } });
    const entityType = target.eventId ? "Event" : target.venueId ? "PartnerVenue" : "ProviderProfile";
    const entityId = target.eventId ?? target.venueId ?? target.providerId ?? note.id;
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "note.added", entityType, entityId }, tx);
  });
}

export async function deleteInternalNote(noteId: string, actor: SessionUser): Promise<void> {
  const note = await db.internalNote.findUnique({ where: { id: noteId } });
  if (!note) return;
  await db.$transaction(async (tx) => {
    await tx.internalNote.delete({ where: { id: noteId } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "note.deleted", entityType: note.eventId ? "Event" : note.venueId ? "PartnerVenue" : "ProviderProfile", entityId: note.eventId ?? note.venueId ?? note.providerId ?? noteId }, tx);
  });
}

/** Venue memory: operational notes from previous missions at the same venue. */
export async function listVenueMemory(venueId: string) {
  return db.internalNote.findMany({ where: { venueId }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
}
