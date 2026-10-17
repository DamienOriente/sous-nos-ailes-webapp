"use server";
import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { addEquipment, deleteEquipment, equipmentSchema } from "@/modules/trade-tools/application/equipment-service";
import { formObject, invalidResult } from "@/modules/trade-tools/application/form-helpers";

const path = (eventId: string) => `/app/evenements/${eventId}/materiel`;

export async function addEquipmentAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const raw = formObject(fd);
    const parsed = equipmentSchema.safeParse({ ...raw, memberId: raw.memberId && raw.memberId !== "none" ? raw.memberId : null });
    if (!parsed.success) return invalidResult(parsed.error);
    await addEquipment(actor, eventId, parsed.data);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteEquipmentAction(eventId: string, itemId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteEquipment(actor, eventId, itemId);
    revalidatePath(path(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
