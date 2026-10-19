"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { acceptOrganizationInvitation } from "@/modules/professionals/application/member-service";

export async function acceptOrganizationInvitationAction(token: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await acceptOrganizationInvitation(actor, String(token ?? ""));
    revalidatePath("/app/pro", "layout");
  } catch (e) {
    return toActionError(e);
  }
  redirect("/app/pro?equipe=1");
}
