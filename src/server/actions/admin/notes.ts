"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionUser } from "@/server/authz";
import { addInternalNote, deleteInternalNote } from "@/server/services/notes";
import { noteSchema } from "@/validation/admin";
import { formDataToObject } from "@/validation/common";
import { actionMessageFor, firstIssueMessage, flashUrl } from "@/server/actions/admin/helpers";

type NoteTarget = { eventId?: string; venueId?: string; providerId?: string };

/** Internal notes stay in Marie's space only. `returnPath` is the admin page to come back to. */
export async function addNoteAction(target: NoteTarget, returnPath: string, formData: FormData): Promise<void> {
  let flash: { notice?: string; error?: string } = {};
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const parsed = noteSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      flash = { error: firstIssueMessage(parsed.error) };
    } else {
      await addInternalNote(target, parsed.data.body, actor);
      flash = { notice: "Note ajoutée." };
    }
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidatePath(returnPath);
  if (target.venueId) revalidatePath("/admin/evenements", "layout");
  redirect(flashUrl(returnPath, flash));
}

export async function deleteNoteAction(noteId: string, returnPath: string): Promise<void> {
  let flash: { notice?: string; error?: string } = {};
  try {
    const actor = await requireActionUser(["ADMIN"]);
    await deleteInternalNote(noteId, actor);
    flash = { notice: "Note supprimée." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidatePath(returnPath);
  redirect(flashUrl(returnPath, flash));
}
