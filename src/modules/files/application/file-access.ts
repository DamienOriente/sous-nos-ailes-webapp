import { and, eq, or } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { channelMembers, eventChannels, eventDocuments, eventProfessionals, messageAttachments, messages, organizationMembers, professionals, type files } from "@/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { canGlobal, getEventAccess, getProfessionalAccess, requireEventPermission, requireGlobalPermission, requireProfessionalManage, type EventAccess } from "@/modules/authorization";
import { PUBLIC_IMAGE_PURPOSES, type FilePurpose, type FileScope } from "@/modules/files/domain/policy";
import { isListingRowPublic } from "@/modules/directory/application/public-listing";

export type FileRecord = typeof files.$inferSelect;

/**
 * Write authorisation on a scope (upload / delete). Throws NotFound when the
 * scope is invisible to the actor, Forbidden when visible but not manageable.
 */
export async function authorizeScopeWrite(actor: Actor, scope: FileScope, scopeId: string, purpose: FilePurpose, executor: DbExecutor = db): Promise<void> {
  switch (scope) {
    case "user":
      if (scopeId !== actor.userId) throw new NotFoundError();
      return;
    case "professional":
      await requireProfessionalManage(actor, scopeId, executor);
      return;
    case "event": {
      const permission = purpose === "attachment" ? "event.channels.post" : purpose === "cover" ? "event.edit" : "event.documents.manage";
      await requireEventPermission(actor, scopeId, permission, executor);
      return;
    }
    case "organization": {
      const [m] = await executor
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, scopeId), eq(organizationMembers.userId, actor.userId)))
        .limit(1);
      if (!m) throw new NotFoundError();
      if (!["owner", "admin", "manager"].includes(m.role)) throw new ForbiddenError();
      return;
    }
    case "system":
      requireGlobalPermission(actor, "admin.settings.manage");
      return;
  }
}

/** A professional image is public when its listing is publicly visible. Anonymous callers allowed. */
export async function isPubliclyVisible(file: FileRecord, executor: DbExecutor = db): Promise<boolean> {
  if (file.scope !== "professional" || !PUBLIC_IMAGE_PURPOSES.has(file.purpose as FilePurpose)) return false;
  const [pro] = await executor.select({ status: professionals.status, deletedAt: professionals.deletedAt, billingHoldAt: professionals.billingHoldAt }).from(professionals).where(eq(professionals.id, file.scopeId)).limit(1);
  return Boolean(pro && isListingRowPublic(pro));
}

/**
 * Read authorisation. Returns false instead of throwing so callers can emit a
 * uniform 404 and log the denial. Never reveals whether the id exists.
 */
export async function canReadFile(actor: Actor | null, file: FileRecord, executor: DbExecutor = db): Promise<boolean> {
  if (file.deletedAt) return false;
  if (actor && file.uploaderUserId === actor.userId) return true;
  switch (file.scope) {
    case "user":
      return Boolean(actor && actor.userId === file.scopeId);
    case "professional": {
      if (actor) {
        const access = await getProfessionalAccess(actor, file.scopeId, executor);
        if (access) return true;
        if (file.purpose === "supporting_document" && canGlobal(actor, "moderation.documents.view")) return true;
        if (PUBLIC_IMAGE_PURPOSES.has(file.purpose as FilePurpose) && canGlobal(actor, "moderation.queue")) return true;
      }
      return isPubliclyVisible(file, executor);
    }
    case "event": {
      if (!actor) return false;
      const access = await getEventAccess(actor, file.scopeId, executor);
      if (!access) return false;
      // The event cover is part of the shared workspace header: every active member sees it.
      if (file.purpose === "cover") return true;
      return canReadEventFile(access, file, executor);
    }
    case "organization": {
      if (!actor) return false;
      const [m] = await executor
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, file.scopeId), eq(organizationMembers.userId, actor.userId)))
        .limit(1);
      return Boolean(m);
    }
    case "system":
      return Boolean(actor && canGlobal(actor, "admin.users.manage"));
  }
}

/**
 * Event files are visible according to the business row that references
 * them (document visibility, channel membership, provider's own quote).
 * A file referenced by nothing is only visible to organisers.
 */
async function canReadEventFile(access: EventAccess, file: FileRecord, executor: DbExecutor): Promise<boolean> {
  const docs = await executor
    .select({ visibility: eventDocuments.visibility, eventProfessionalId: eventDocuments.eventProfessionalId })
    .from(eventDocuments)
    .where(and(eq(eventDocuments.fileId, file.id), eq(eventDocuments.eventId, file.scopeId)));
  for (const d of docs) {
    if (documentVisible(access, d.visibility)) return true;
    if (d.eventProfessionalId && (await ownsEventProfessional(access, d.eventProfessionalId, executor))) return true;
  }

  const provRows = await executor
    .select({ id: eventProfessionals.id, professionalId: eventProfessionals.professionalId })
    .from(eventProfessionals)
    .where(and(eq(eventProfessionals.eventId, file.scopeId), or(eq(eventProfessionals.quoteFileId, file.id), eq(eventProfessionals.contractFileId, file.id))));
  for (const p of provRows) {
    if (access.permissions.has("event.providers.view") && access.isOrganizer) return true;
    if (p.professionalId && access.professionalId === p.professionalId) return true;
  }

  const attachments = await executor
    .select({ channelId: messages.channelId, isOpen: eventChannels.isOpenToAllMembers, archivedAt: eventChannels.archivedAt })
    .from(messageAttachments)
    .innerJoin(messages, eq(messages.id, messageAttachments.messageId))
    .innerJoin(eventChannels, eq(eventChannels.id, messages.channelId))
    .where(and(eq(messageAttachments.fileId, file.id), eq(messages.eventId, file.scopeId)));
  for (const a of attachments) {
    if (access.permissions.has("event.channels.view_all") || a.isOpen) return true;
    const [cm] = await executor
      .select({ channelId: channelMembers.channelId })
      .from(channelMembers)
      .where(and(eq(channelMembers.channelId, a.channelId), eq(channelMembers.memberId, access.memberId)))
      .limit(1);
    if (cm) return true;
  }

  if (docs.length === 0 && provRows.length === 0 && attachments.length === 0) {
    return access.isOrganizer && access.permissions.has("event.documents.view");
  }
  return false;
}

function documentVisible(access: EventAccess, visibility: string): boolean {
  if (visibility === "organizers") return access.isOrganizer && access.permissions.has("event.documents.view");
  if (visibility === "team" || visibility === "all") return access.permissions.has("event.documents.view");
  if (visibility.startsWith("roles:")) {
    const roles = visibility.slice("roles:".length).split(",").map((r) => r.trim());
    return access.isOrganizer || (roles.includes(access.role) && access.permissions.has("event.documents.view"));
  }
  return false;
}

async function ownsEventProfessional(access: EventAccess, eventProfessionalId: string, executor: DbExecutor): Promise<boolean> {
  if (!access.professionalId) return false;
  const [row] = await executor.select({ professionalId: eventProfessionals.professionalId }).from(eventProfessionals).where(eq(eventProfessionals.id, eventProfessionalId)).limit(1);
  return Boolean(row && row.professionalId === access.professionalId);
}
