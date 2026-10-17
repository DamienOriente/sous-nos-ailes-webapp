"use server";
import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { createEvent } from "@/modules/events/application/event-service";

/** Input is validated by the service (Zod); the action only maps errors. */
export async function createEventAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const created = await createEvent(actor, input);
    revalidatePath("/app/evenements");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    return toActionError(e);
  }
}
