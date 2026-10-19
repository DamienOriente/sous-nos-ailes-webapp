import { and, desc, eq, ilike, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { eventChannels, eventMembers, files, messageAttachments, messages, reports, users } from "@/db/schema";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission, type EventAccess } from "@/modules/authorization";
import { channelVisibilityFilter } from "@/modules/collaboration/application/channel-service";
import { resolveMentions } from "@/modules/collaboration/domain/mentions";
import { REPORT_REASONS } from "@/modules/collaboration/domain/report-reasons";
import { openModerationCase } from "@/modules/moderation/application/moderation-service";
import { notify } from "@/modules/notifications/application/notification-service";

export const PAGE_SIZE = 40;

export type MessageRow = {
  id: string;
  channelId: string;
  body: string;
  authorUserId: string;
  authorName: string;
  mentions: string[];
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  reportedAt: Date | null;
  isMine: boolean;
  attachments: Array<{ id: string; fileId: string; name: string | null; mimeType: string | null; sizeBytes: number | null; status: string | null }>;
};

async function visibleChannel(access: EventAccess, eventId: string, channelId: string, executor: DbExecutor) {
  const [c] = await executor.select().from(eventChannels).where(and(eq(eventChannels.id, channelId), channelVisibilityFilter(access, eventId))).limit(1);
  if (!c) throw new NotFoundError();
  return c;
}

async function attachmentsFor(messageIds: string[], executor: DbExecutor) {
  if (!messageIds.length) return new Map<string, MessageRow["attachments"]>();
  const rows = await executor
    .select({ id: messageAttachments.id, messageId: messageAttachments.messageId, fileId: messageAttachments.fileId, name: files.originalName, mimeType: files.mimeType, sizeBytes: files.sizeBytes, status: files.status })
    .from(messageAttachments)
    .leftJoin(files, eq(files.id, messageAttachments.fileId))
    .where(inArray(messageAttachments.messageId, messageIds));
  const map = new Map<string, MessageRow["attachments"]>();
  for (const r of rows) {
    const list = map.get(r.messageId) ?? [];
    list.push({ id: r.id, fileId: r.fileId, name: r.name, mimeType: r.mimeType, sizeBytes: r.sizeBytes, status: r.status });
    map.set(r.messageId, list);
  }
  return map;
}

/** Oldest first; `before` (message createdAt ISO) loads the previous page. */
export async function listMessages(actor: Actor, eventId: string, channelId: string, opts: { before?: string | null } = {}, executor: DbExecutor = db): Promise<{ access: EventAccess; messages: MessageRow[]; hasMore: boolean }> {
  const access = await requireEventPermission(actor, eventId, "event.view", executor);
  await visibleChannel(access, eventId, channelId, executor);
  const before = opts.before ? new Date(opts.before) : null;
  const rows = await executor
    .select({ m: messages, authorName: users.name })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.authorUserId))
    .where(and(eq(messages.channelId, channelId), before && !Number.isNaN(before.getTime()) ? lt(messages.createdAt, before) : undefined))
    .orderBy(desc(messages.createdAt))
    .limit(PAGE_SIZE + 1);
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE).reverse();
  const atts = await attachmentsFor(page.map((r) => r.m.id), executor);
  return {
    access,
    hasMore,
    messages: page.map((r) => ({
      id: r.m.id,
      channelId: r.m.channelId,
      body: r.m.deletedAt ? "" : r.m.body,
      authorUserId: r.m.authorUserId,
      authorName: r.authorName,
      mentions: r.m.mentions,
      createdAt: r.m.createdAt,
      editedAt: r.m.editedAt,
      deletedAt: r.m.deletedAt,
      reportedAt: r.m.reportedAt,
      isMine: r.m.authorUserId === actor.userId,
      attachments: r.m.deletedAt ? [] : (atts.get(r.m.id) ?? []),
    })),
  };
}

export const postMessageSchema = z.object({
  body: z.string().trim().max(4000),
  attachmentFileIds: z.array(z.uuid()).max(5).default([]),
});

export async function postMessage(actor: Actor, eventId: string, channelId: string, raw: unknown, executor: DbExecutor = db): Promise<{ id: string; mentionedUserIds: string[] }> {
  const access = await requireEventPermission(actor, eventId, "event.channels.post", executor);
  const channel = await visibleChannel(access, eventId, channelId, executor);
  if (channel.archivedAt) throw new ForbiddenError("Ce canal est archivé.");
  const parsed = postMessageSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Message invalide.", { issues: parsed.error.issues });
  const { body, attachmentFileIds } = parsed.data;
  if (!body && attachmentFileIds.length === 0) throw new ValidationError("Le message est vide.");
  if (attachmentFileIds.length) {
    const ok = await executor.select({ id: files.id }).from(files).where(and(inArray(files.id, attachmentFileIds), eq(files.scope, "event"), eq(files.scopeId, eventId), inArray(files.status, ["quarantined", "scanning", "clean"])));
    if (ok.length !== attachmentFileIds.length) throw new ValidationError("Pièce jointe introuvable ou refusée.");
  }
  // Mentions are resolved against the people who can read this channel.
  const readers = await executor
    .select({ userId: eventMembers.userId, name: users.name })
    .from(eventMembers)
    .innerJoin(users, eq(users.id, eventMembers.userId))
    .where(
      and(
        eq(eventMembers.eventId, eventId),
        eq(eventMembers.status, "active"),
        channel.isOpenToAllMembers ? undefined : sql`(exists (select 1 from channel_members cm where cm.channel_id = ${channelId} and cm.member_id = ${eventMembers.id}) or ${eventMembers.role} in ('owner','lead_organizer','co_organizer','wedding_planner'))`,
      ),
    );
  const mentioned = resolveMentions(body, readers).filter((id) => id !== actor.userId);
  const [row] = await executor.insert(messages).values({ channelId, eventId, authorUserId: actor.userId, body, mentions: mentioned }).returning({ id: messages.id });
  if (!row) throw new Error("message insert failed");
  if (attachmentFileIds.length) await executor.insert(messageAttachments).values(attachmentFileIds.map((fileId) => ({ messageId: row.id, fileId })));
  for (const userId of mentioned) {
    await notify(
      {
        userId,
        type: "new_message",
        title: `${actor.name} vous a mentionné dans « ${channel.name} »`,
        body: body.slice(0, 140),
        href: `/app/evenements/${eventId}/messages/${channelId}`,
        eventId,
        dedupeKey: `mention:${channelId}:${userId}`,
      },
      executor,
    );
  }
  return { id: row.id, mentionedUserIds: mentioned };
}

export async function editMessage(actor: Actor, eventId: string, messageId: string, body: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.channels.post", executor);
  const [m] = await executor.select().from(messages).where(and(eq(messages.id, messageId), eq(messages.eventId, eventId))).limit(1);
  if (!m) throw new NotFoundError();
  if (m.authorUserId !== actor.userId) throw new ForbiddenError("Vous ne pouvez modifier que vos propres messages.");
  if (m.deletedAt) throw new ForbiddenError("Ce message a été supprimé.");
  const text = body.trim();
  if (!text || text.length > 4000) throw new ValidationError("Message vide ou trop long.");
  await executor.update(messages).set({ body: text, editedAt: new Date() }).where(eq(messages.id, messageId));
}

/** Soft delete: body is hidden, the row stays for moderation/audit. */
export async function deleteMessage(actor: Actor, eventId: string, messageId: string, executor: DbExecutor = db): Promise<void> {
  const access = await requireEventPermission(actor, eventId, "event.view", executor);
  const [m] = await executor.select().from(messages).where(and(eq(messages.id, messageId), eq(messages.eventId, eventId))).limit(1);
  if (!m) throw new NotFoundError();
  if (m.authorUserId !== actor.userId && !access.permissions.has("event.channels.manage")) throw new ForbiddenError("Vous ne pouvez supprimer que vos propres messages.");
  await executor.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, messageId));
}

export { REPORT_REASONS } from "@/modules/collaboration/domain/report-reasons";

export async function reportMessage(actor: Actor, eventId: string, messageId: string, reason: (typeof REPORT_REASONS)[number], details: string | null, executor: DbExecutor = db): Promise<void> {
  const access = await requireEventPermission(actor, eventId, "event.view", executor);
  const [m] = await executor
    .select({ id: messages.id, channelId: messages.channelId, authorUserId: messages.authorUserId })
    .from(messages)
    .innerJoin(eventChannels, eq(eventChannels.id, messages.channelId))
    .where(and(eq(messages.id, messageId), eq(messages.eventId, eventId), channelVisibilityFilter(access, eventId)))
    .limit(1);
  if (!m) throw new NotFoundError();
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) throw new ValidationError("Motif inconnu.");
  const moderationCase = await openModerationCase({ kind: "report", resourceType: "message", resourceId: messageId, openedByUserId: actor.userId, summary: `Message signalé (${reason}) dans un évènement.` }, executor);
  await executor.insert(reports).values({ reporterUserId: actor.userId, resourceType: "message", resourceId: messageId, reason, details: details?.trim().slice(0, 1000) || null, caseId: moderationCase.caseId });
  await executor.update(messages).set({ reportedAt: new Date() }).where(eq(messages.id, messageId));
}

export async function searchMessages(actor: Actor, eventId: string, query: string, executor: DbExecutor = db) {
  const access = await requireEventPermission(actor, eventId, "event.view", executor);
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await executor
    .select({ id: messages.id, channelId: messages.channelId, channelName: eventChannels.name, body: messages.body, authorName: users.name, createdAt: messages.createdAt })
    .from(messages)
    .innerJoin(eventChannels, eq(eventChannels.id, messages.channelId))
    .innerJoin(users, eq(users.id, messages.authorUserId))
    .where(and(eq(messages.eventId, eventId), isNull(messages.deletedAt), channelVisibilityFilter(access, eventId), ilike(messages.body, `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)))
    .orderBy(desc(messages.createdAt))
    .limit(50);
  return rows;
}

