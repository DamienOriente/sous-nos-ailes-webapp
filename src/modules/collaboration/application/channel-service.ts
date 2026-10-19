import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { channelMembers, eventChannels, eventMembers, messages, users } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission, type EventAccess } from "@/modules/authorization";
import { recordAudit } from "@/modules/events/application/audit";

export type ChannelRow = {
  id: string;
  kind: "general" | "topic" | "coordination" | "direct";
  name: string;
  description: string | null;
  isOpenToAllMembers: boolean;
  archivedAt: Date | null;
  isMember: boolean;
  unread: number;
  lastMessageAt: Date | null;
  memberCount: number;
};

/** Channel visibility: open channels, channels I'm a member of, or everything for `event.channels.view_all`. */
export function channelVisibilityFilter(access: EventAccess, eventId: string) {
  const base = eq(eventChannels.eventId, eventId);
  if (access.permissions.has("event.channels.view_all")) return base;
  return and(base, or(eq(eventChannels.isOpenToAllMembers, true), sql`exists (select 1 from channel_members cm where cm.channel_id = ${eventChannels.id} and cm.member_id = ${access.memberId})`))!;
}

export async function listChannels(actor: Actor, eventId: string, opts: { includeArchived?: boolean } = {}, executor: DbExecutor = db): Promise<{ access: EventAccess; channels: ChannelRow[] }> {
  const access = await requireEventPermission(actor, eventId, "event.view", executor);
  const rows = await executor
    .select({
      c: eventChannels,
      lastReadAt: channelMembers.lastReadAt,
      isMember: sql<boolean>`${channelMembers.memberId} is not null`,
      lastMessageAt: sql<Date | null>`(select max(m.created_at) from messages m where m.channel_id = ${eventChannels.id} and m.deleted_at is null)`,
      memberCount: sql<number>`case when ${eventChannels.isOpenToAllMembers} then (select count(*) from event_members em where em.event_id = ${eventChannels.eventId} and em.status = 'active') else (select count(*) from channel_members cm2 where cm2.channel_id = ${eventChannels.id}) end::int`,
    })
    .from(eventChannels)
    .leftJoin(channelMembers, and(eq(channelMembers.channelId, eventChannels.id), eq(channelMembers.memberId, access.memberId)))
    .where(and(channelVisibilityFilter(access, eventId), opts.includeArchived ? undefined : isNull(eventChannels.archivedAt)))
    .orderBy(sql`case ${eventChannels.kind} when 'general' then 0 else 1 end`, asc(eventChannels.createdAt));
  const channels: ChannelRow[] = [];
  for (const r of rows) {
    const [u] = await executor
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.channelId, r.c.id), isNull(messages.deletedAt), sql`${messages.authorUserId} <> ${actor.userId}`, r.lastReadAt ? gt(messages.createdAt, r.lastReadAt) : undefined));
    channels.push({
      id: r.c.id,
      kind: r.c.kind,
      name: r.c.name,
      description: r.c.description,
      isOpenToAllMembers: r.c.isOpenToAllMembers,
      archivedAt: r.c.archivedAt,
      isMember: r.isMember || r.c.isOpenToAllMembers,
      unread: u?.n ?? 0,
      lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt) : null,
      memberCount: r.memberCount,
    });
  }
  return { access, channels };
}

export async function getChannel(actor: Actor, eventId: string, channelId: string, executor: DbExecutor = db) {
  const access = await requireEventPermission(actor, eventId, "event.view", executor);
  const [c] = await executor
    .select()
    .from(eventChannels)
    .where(and(eq(eventChannels.id, channelId), channelVisibilityFilter(access, eventId)))
    .limit(1);
  if (!c) throw new NotFoundError();
  const members = await executor
    .select({ memberId: eventMembers.id, userId: eventMembers.userId, name: users.name, role: eventMembers.role })
    .from(eventMembers)
    .innerJoin(users, eq(users.id, eventMembers.userId))
    .where(
      and(
        eq(eventMembers.eventId, eventId),
        eq(eventMembers.status, "active"),
        c.isOpenToAllMembers ? undefined : sql`exists (select 1 from channel_members cm where cm.channel_id = ${channelId} and cm.member_id = ${eventMembers.id})`,
      ),
    )
    .orderBy(asc(users.name));
  return { access, channel: c, members };
}

export const createChannelSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court.").max(80),
  description: z.string().trim().max(300).nullable().optional(),
  kind: z.enum(["topic", "coordination"]).default("topic"),
  memberIds: z.array(z.uuid()).max(200).default([]),
  isOpenToAllMembers: z.boolean().default(false),
});

export async function createChannel(actor: Actor, eventId: string, raw: unknown, executor: DbExecutor = db): Promise<{ id: string }> {
  const access = await requireEventPermission(actor, eventId, "event.channels.manage", executor);
  const parsed = createChannelSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Canal invalide.", { issues: parsed.error.issues });
  const d = parsed.data;
  const memberIds = new Set([access.memberId, ...d.memberIds]);
  const valid = await executor.select({ id: eventMembers.id }).from(eventMembers).where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, "active"), inArray(eventMembers.id, [...memberIds])));
  if (valid.length !== memberIds.size) throw new ValidationError("Un des membres choisis n'appartient pas à l'évènement.");
  const [row] = await executor
    .insert(eventChannels)
    .values({ eventId, kind: d.kind, name: d.name, description: d.description ?? null, isOpenToAllMembers: d.isOpenToAllMembers, createdByUserId: actor.userId })
    .returning({ id: eventChannels.id });
  if (!row) throw new Error("channel insert failed");
  await executor.insert(channelMembers).values([...memberIds].map((memberId) => ({ channelId: row.id, memberId, lastReadAt: memberId === access.memberId ? new Date() : null })));
  return row;
}

export async function updateChannelMembers(actor: Actor, eventId: string, channelId: string, memberIds: string[], executor: DbExecutor = db): Promise<void> {
  const access = await requireEventPermission(actor, eventId, "event.channels.manage", executor);
  const [c] = await executor.select().from(eventChannels).where(and(eq(eventChannels.id, channelId), eq(eventChannels.eventId, eventId))).limit(1);
  if (!c) throw new NotFoundError();
  if (c.kind === "general" || c.isOpenToAllMembers) throw new ConflictError("Ce canal est ouvert à toute l'équipe.");
  const wanted = new Set([access.memberId, ...memberIds]);
  const valid = await executor.select({ id: eventMembers.id }).from(eventMembers).where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, "active"), inArray(eventMembers.id, [...wanted])));
  if (valid.length !== wanted.size) throw new ValidationError("Un des membres choisis n'appartient pas à l'évènement.");
  const current = await executor.select({ memberId: channelMembers.memberId }).from(channelMembers).where(eq(channelMembers.channelId, channelId));
  const currentIds = new Set(current.map((m) => m.memberId));
  const toAdd = [...wanted].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !wanted.has(id));
  if (toAdd.length) await executor.insert(channelMembers).values(toAdd.map((memberId) => ({ channelId, memberId }))).onConflictDoNothing();
  if (toRemove.length) await executor.delete(channelMembers).where(and(eq(channelMembers.channelId, channelId), inArray(channelMembers.memberId, toRemove)));
}

export async function archiveChannel(actor: Actor, eventId: string, channelId: string, archive: boolean, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.channels.manage", executor);
  const [c] = await executor.select({ id: eventChannels.id, kind: eventChannels.kind }).from(eventChannels).where(and(eq(eventChannels.id, channelId), eq(eventChannels.eventId, eventId))).limit(1);
  if (!c) throw new NotFoundError();
  if (c.kind === "general") throw new ForbiddenError("Le canal général ne peut pas être archivé.");
  await executor.update(eventChannels).set({ archivedAt: archive ? new Date() : null }).where(eq(eventChannels.id, channelId));
  await recordAudit({ actorUserId: actor.userId, action: archive ? "event.channel.archived" : "event.channel.restored", resourceType: "event_channel", resourceId: channelId, eventId }, executor);
}

export async function markChannelRead(actor: Actor, eventId: string, channelId: string, executor: DbExecutor = db): Promise<void> {
  const access = await requireEventPermission(actor, eventId, "event.view", executor);
  const [c] = await executor.select({ id: eventChannels.id }).from(eventChannels).where(and(eq(eventChannels.id, channelId), channelVisibilityFilter(access, eventId))).limit(1);
  if (!c) throw new NotFoundError();
  await executor
    .insert(channelMembers)
    .values({ channelId, memberId: access.memberId, lastReadAt: new Date() })
    .onConflictDoUpdate({ target: [channelMembers.channelId, channelMembers.memberId], set: { lastReadAt: new Date() } });
}
