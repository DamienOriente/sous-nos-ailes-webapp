"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { changeEventStatus, deleteEvent, updateEvent, updateEventCover } from "@/modules/events/application/event-service";
import type { EventStatus } from "@/modules/events/domain/event-status";

export async function updateEventAction(eventId: string, input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await updateEvent(actor, z.uuid().parse(eventId), input);
    revalidatePath(`/app/evenements/${eventId}`, "layout");
    revalidatePath("/app/evenements");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function changeStatusAction(eventId: string, to: EventStatus, reason?: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await changeEventStatus(actor, z.uuid().parse(eventId), to, reason ?? null);
    revalidatePath(`/app/evenements/${eventId}`, "layout");
    revalidatePath("/app/evenements");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteEventAction(eventId: string, confirmName: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteEvent(actor, z.uuid().parse(eventId), String(confirmName ?? ""));
    revalidatePath("/app/evenements");
  } catch (e) {
    return toActionError(e);
  }
  redirect("/app/evenements?supprime=1");
}

export async function updateEventCoverAction(eventId: string, input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await updateEventCover(actor, z.uuid().parse(eventId), input);
    revalidatePath(`/app/evenements/${eventId}`, "layout");
    revalidatePath("/app/evenements");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
