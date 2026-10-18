"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { answerQuote } from "@/modules/inquiries/application/inquiry-service";

export async function answerQuoteAction(eventId: string, inquiryId: string, decision: "accepted" | "declined"): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const ids = z.object({ eventId: z.uuid(), inquiryId: z.uuid(), decision: z.enum(["accepted", "declined"]) }).parse({ eventId, inquiryId, decision });
    await answerQuote(actor, ids.eventId, ids.inquiryId, ids.decision);
    revalidatePath(`/app/evenements/${ids.eventId}/devis`);
    revalidatePath(`/app/evenements/${ids.eventId}/demandes`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
