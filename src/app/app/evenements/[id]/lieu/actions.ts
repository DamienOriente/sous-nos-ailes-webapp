"use server";
import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { parseLocalDateTime } from "@/modules/calendar/domain/datetime";
import { formObject, invalidResult } from "@/modules/trade-tools/application/form-helpers";
import { addAllocation, addSpace, allocationSchema, deleteAllocation, deleteSpace, logisticsSchema, spaceSchema, upsertLogistics } from "@/modules/trade-tools/application/venue-service";

const path = (eventId: string) => `/app/evenements/${eventId}/lieu`;

export async function addSpaceAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const raw = formObject(fd);
    const parsed = spaceSchema.safeParse({ ...raw, capacity: raw.capacity ? raw.capacity : null });
    if (!parsed.success) return invalidResult(parsed.error);
    await addSpace(actor, eventId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteSpaceAction(eventId: string, spaceId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteSpace(actor, eventId, spaceId);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addAllocationAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const tz = await getUserTimezone(actor.userId);
    const raw = formObject(fd);
    const parsed = allocationSchema.safeParse({ ...raw, milestoneId: raw.milestoneId && raw.milestoneId !== "none" ? raw.milestoneId : null, startsAt: parseLocalDateTime(raw.startsAt, tz) ?? "", endsAt: parseLocalDateTime(raw.endsAt, tz) });
    if (!parsed.success) return invalidResult(parsed.error);
    await addAllocation(actor, eventId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteAllocationAction(eventId: string, allocationId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteAllocation(actor, eventId, allocationId);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveLogisticsAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = logisticsSchema.safeParse(formObject(fd));
    if (!parsed.success) return invalidResult(parsed.error);
    await upsertLogistics(actor, eventId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
