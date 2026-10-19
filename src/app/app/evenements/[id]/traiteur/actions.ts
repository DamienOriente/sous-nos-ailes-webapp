"use server";
import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { parseLocalDateTime } from "@/modules/calendar/domain/datetime";
import { addMenu, addServiceStep, cateringPlanSchema, deleteMenu, deleteServiceStep, menuSchema, serviceStepSchema, updateMenu, upsertCateringPlan } from "@/modules/trade-tools/application/catering-service";
import { formObject, invalidResult } from "@/modules/trade-tools/application/form-helpers";

const path = (eventId: string) => `/app/evenements/${eventId}/traiteur`;

export async function savePlanAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = cateringPlanSchema.safeParse(formObject(fd));
    if (!parsed.success) return invalidResult(parsed.error);
    await upsertCateringPlan(actor, eventId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addMenuAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const raw = formObject(fd);
    const parsed = menuSchema.safeParse({ ...raw, pricePerCoverCents: raw.pricePerCover ? Math.round(Number(raw.pricePerCover.replace(",", ".")) * 100) : null });
    if (!parsed.success) return invalidResult(parsed.error);
    await addMenu(actor, eventId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateMenuAction(eventId: string, menuId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const raw = formObject(fd);
    const parsed = menuSchema.safeParse({ ...raw, pricePerCoverCents: raw.pricePerCover ? Math.round(Number(raw.pricePerCover.replace(",", ".")) * 100) : null });
    if (!parsed.success) return invalidResult(parsed.error);
    await updateMenu(actor, eventId, menuId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteMenuAction(eventId: string, menuId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteMenu(actor, eventId, menuId);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addStepAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const tz = await getUserTimezone(actor.userId);
    const raw = formObject(fd);
    const parsed = serviceStepSchema.safeParse({ ...raw, startsAt: parseLocalDateTime(raw.startsAt, tz) ?? "", endsAt: parseLocalDateTime(raw.endsAt, tz) });
    if (!parsed.success) return invalidResult(parsed.error);
    await addServiceStep(actor, eventId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteStepAction(eventId: string, stepId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteServiceStep(actor, eventId, stepId);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
