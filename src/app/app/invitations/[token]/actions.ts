"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { acceptInvitation } from "@/modules/events/application/provider-service";

export async function acceptInvitationAction(token: string): Promise<ActionResult> {
  let eventId: string;
  try {
    const actor = await requireActorOrThrow();
    const res = await acceptInvitation(actor, String(token ?? ""));
    eventId = res.eventId;
    revalidatePath("/app/evenements");
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/app/evenements/${eventId}?bienvenue=1`);
}
