"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { addDocument, deleteDocument } from "@/modules/events/application/document-service";

export async function addDocumentAction(eventId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const res = await addDocument(actor, z.uuid().parse(eventId), input);
    revalidatePath(`/app/evenements/${eventId}/documents`);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteDocumentAction(eventId: string, documentId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteDocument(actor, z.uuid().parse(eventId), z.uuid().parse(documentId));
    revalidatePath(`/app/evenements/${eventId}/documents`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
