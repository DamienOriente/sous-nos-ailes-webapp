"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { APPLICATION_STATUS_LABELS } from "@/domain/labels";
import { requireActionUser } from "@/server/authz";
import { DomainError } from "@/server/errors";
import { markContactHandled, setApplicationStatus } from "@/server/services/applications";
import { actionMessageFor, flashUrl, readString } from "@/server/actions/admin/helpers";

const PATH = "/admin/candidatures";

function isApplicationStatus(value: string): value is ApplicationStatus {
  return Object.values(ApplicationStatus).includes(value as ApplicationStatus);
}

/** `status` comes from the clicked button; the note is optional. */
export async function setApplicationStatusAction(applicationId: string, formData: FormData): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const status = readString(formData, "status");
    const note = readString(formData, "note");
    if (!isApplicationStatus(status)) throw new DomainError("Statut inconnu.");
    if (note.length > 1000) throw new DomainError("Note trop longue (1000 caractères maximum).");
    await setApplicationStatus(applicationId, status, note || null, actor);
    flash = { notice: `Candidature : ${APPLICATION_STATUS_LABELS[status]}.` };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidatePath(PATH);
  revalidatePath("/admin");
  redirect(flashUrl(PATH, flash));
}

export async function markContactHandledAction(messageId: string): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    await requireActionUser(["ADMIN"]);
    await markContactHandled(messageId);
    flash = { notice: "Message marqué comme traité." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidatePath(PATH);
  revalidatePath("/admin");
  redirect(flashUrl(`${PATH}`, flash) + (flash.error ? "" : "#contacts"));
}
