"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/errors";
import { toActionError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { setToolEnabled } from "@/modules/tools/application/tool-service";

const schema = z.object({ professionalId: z.uuid(), toolKey: z.string().min(1).max(60), enabled: z.boolean() });

export async function setToolEnabledAction(professionalId: string, toolKey: string, enabled: boolean): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const input = schema.parse({ professionalId, toolKey, enabled });
    await setToolEnabled(actor, input.professionalId, input.toolKey, input.enabled);
    revalidatePath(`/app/pro/${professionalId}/outils`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
