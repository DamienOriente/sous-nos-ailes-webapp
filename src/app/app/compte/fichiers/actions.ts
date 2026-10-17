"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { deleteFile } from "@/modules/files/application/file-service";

const idSchema = z.uuid();

export async function deleteMyFileAction(fileId: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = idSchema.safeParse(fileId);
    if (!parsed.success) throw new ValidationError();
    await deleteFile(actor, parsed.data);
    revalidatePath("/app/compte/fichiers");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
