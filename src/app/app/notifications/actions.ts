"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { isNotificationType, listNotificationsPage, markAllNotificationsRead, markNotificationRead, toNotificationItem, type NotificationItem } from "@/modules/notifications/application/notification-service";

const idSchema = z.uuid();
const loadSchema = z.object({ offset: z.number().int().min(0).max(10_000), type: z.string().optional(), unreadOnly: z.boolean().optional() });

export async function markNotificationReadAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) throw new ValidationError();
    await markNotificationRead(actor.userId, parsed.data);
    revalidatePath("/app", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function markAllNotificationsReadAction(type?: string): Promise<ActionResult<{ count: number }>> {
  try {
    const actor = await requireActorOrThrow();
    const count = await markAllNotificationsRead(actor.userId, { type: type && isNotificationType(type) ? type : undefined });
    revalidatePath("/app", "layout");
    return { ok: true, data: { count } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function loadMoreNotificationsAction(filter: { type?: string; unreadOnly?: boolean }, offset: number): Promise<ActionResult<{ items: NotificationItem[]; nextOffset: number | null }>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = loadSchema.safeParse({ ...filter, offset });
    if (!parsed.success) throw new ValidationError();
    const page = await listNotificationsPage(actor.userId, {
      offset: parsed.data.offset,
      type: parsed.data.type && isNotificationType(parsed.data.type) ? parsed.data.type : undefined,
      unreadOnly: parsed.data.unreadOnly,
    });
    return { ok: true, data: { items: page.items.map(toNotificationItem), nextOffset: page.nextOffset } };
  } catch (e) {
    return toActionError(e);
  }
}
