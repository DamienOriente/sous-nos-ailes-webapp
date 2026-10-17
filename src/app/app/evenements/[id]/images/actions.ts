"use server";
import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { parseLocalDateTime } from "@/modules/calendar/domain/datetime";
import { formObject, invalidResult } from "@/modules/trade-tools/application/form-helpers";
import { addShot, deleteShot, imageBriefSchema, shotSchema, toggleShotConsent, upsertImageBrief } from "@/modules/trade-tools/application/images-service";

const path = (eventId: string) => `/app/evenements/${eventId}/images`;

export async function saveImageBriefAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = imageBriefSchema.safeParse(formObject(fd));
    if (!parsed.success) return invalidResult(parsed.error);
    await upsertImageBrief(actor, eventId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addShotAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const tz = await getUserTimezone(actor.userId);
    const raw = formObject(fd);
    const parsed = shotSchema.safeParse({ ...raw, startsAt: parseLocalDateTime(raw.startsAt, tz), releaseConsentCollected: raw.releaseConsentCollected === "on" || raw.releaseConsentCollected === "true" });
    if (!parsed.success) return invalidResult(parsed.error);
    await addShot(actor, eventId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleConsentAction(eventId: string, itemId: string, collected: boolean): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await toggleShotConsent(actor, eventId, itemId, collected);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteShotAction(eventId: string, itemId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteShot(actor, eventId, itemId);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
