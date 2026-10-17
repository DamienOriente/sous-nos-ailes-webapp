"use server";
import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { parseLocalDateTime } from "@/modules/calendar/domain/datetime";
import { formObject, invalidResult } from "@/modules/trade-tools/application/form-helpers";
import { addKeyMoment, deleteKeyMoment, keyMomentSchema, musicBriefSchema, upsertMusicBrief } from "@/modules/trade-tools/application/music-service";

const path = (eventId: string) => `/app/evenements/${eventId}/musique`;

export async function saveBriefAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = musicBriefSchema.safeParse(formObject(fd));
    if (!parsed.success) return invalidResult(parsed.error);
    await upsertMusicBrief(actor, eventId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addMomentAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const tz = await getUserTimezone(actor.userId);
    const raw = formObject(fd);
    const parsed = keyMomentSchema.safeParse({ ...raw, startsAt: parseLocalDateTime(raw.startsAt, tz) });
    if (!parsed.success) return invalidResult(parsed.error);
    await addKeyMoment(actor, eventId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteMomentAction(eventId: string, momentId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteKeyMoment(actor, eventId, momentId);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
