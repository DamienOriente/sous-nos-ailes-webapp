"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { archiveChannel, createChannel, markChannelRead, updateChannelMembers } from "@/modules/collaboration/application/channel-service";
import { deleteMessage, editMessage, listMessages, postMessage, reportMessage, searchMessages, type MessageRow, type REPORT_REASONS } from "@/modules/collaboration/application/message-service";

const ids = z.object({ eventId: z.uuid(), channelId: z.uuid() });

function revalidate(eventId: string, channelId?: string) {
  revalidatePath(`/app/evenements/${eventId}/messages`);
  if (channelId) revalidatePath(`/app/evenements/${eventId}/messages/${channelId}`);
}

export type SerializedMessage = Omit<MessageRow, "createdAt" | "editedAt" | "deletedAt" | "reportedAt"> & { createdAt: string; editedAt: string | null; deletedAt: string | null; reportedAt: string | null };
const serialize = (m: MessageRow): SerializedMessage => ({ ...m, createdAt: m.createdAt.toISOString(), editedAt: m.editedAt?.toISOString() ?? null, deletedAt: m.deletedAt?.toISOString() ?? null, reportedAt: m.reportedAt?.toISOString() ?? null });

export async function postMessageAction(eventId: string, channelId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, channelId });
    const res = await postMessage(actor, p.eventId, p.channelId, input);
    await markChannelRead(actor, p.eventId, p.channelId);
    revalidate(eventId, channelId);
    return { ok: true, data: { id: res.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function loadOlderMessagesAction(eventId: string, channelId: string, before: string): Promise<ActionResult<{ messages: SerializedMessage[]; hasMore: boolean }>> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, channelId });
    const res = await listMessages(actor, p.eventId, p.channelId, { before });
    return { ok: true, data: { messages: res.messages.map(serialize), hasMore: res.hasMore } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function editMessageAction(eventId: string, messageId: string, body: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await editMessage(actor, z.uuid().parse(eventId), z.uuid().parse(messageId), String(body ?? ""));
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteMessageAction(eventId: string, messageId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteMessage(actor, z.uuid().parse(eventId), z.uuid().parse(messageId));
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function reportMessageAction(eventId: string, messageId: string, reason: (typeof REPORT_REASONS)[number], details: string | null): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await reportMessage(actor, z.uuid().parse(eventId), z.uuid().parse(messageId), reason, details);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function markReadAction(eventId: string, channelId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, channelId });
    await markChannelRead(actor, p.eventId, p.channelId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createChannelAction(eventId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const res = await createChannel(actor, z.uuid().parse(eventId), input);
    revalidate(eventId);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateChannelMembersAction(eventId: string, channelId: string, memberIds: string[]): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, channelId });
    await updateChannelMembers(actor, p.eventId, p.channelId, z.array(z.uuid()).parse(memberIds));
    revalidate(eventId, channelId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function archiveChannelAction(eventId: string, channelId: string, archive: boolean): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, channelId });
    await archiveChannel(actor, p.eventId, p.channelId, Boolean(archive));
    revalidate(eventId, channelId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export type SearchHit = { id: string; channelId: string; channelName: string; body: string; authorName: string; createdAt: string };
export async function searchMessagesAction(eventId: string, query: string): Promise<ActionResult<SearchHit[]>> {
  try {
    const actor = await requireActorOrThrow();
    const rows = await searchMessages(actor, z.uuid().parse(eventId), String(query ?? ""));
    return { ok: true, data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  } catch (e) {
    return toActionError(e);
  }
}
