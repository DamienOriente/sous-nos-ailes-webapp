"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { addRetroplanningTasks } from "@/modules/events/application/retroplanning-service";

export async function addRetroplanningTasksAction(eventId: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const id = z.uuid().parse(eventId);
    await addRetroplanningTasks(actor, id);
    revalidatePath(`/app/evenements/${id}`, "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
