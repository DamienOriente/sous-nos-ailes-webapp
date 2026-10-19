"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { decideOnProfessional } from "@/modules/moderation/application/moderation-service";

export async function directDecisionAction(formData: FormData): Promise<ActionResult<{ caseId: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ professionalId: z.uuid(), decision: z.enum(["suspend", "reinstate", "request_changes", "approve"]), reason: z.string().min(1).max(2000) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Paramètres invalides.");
    const res = await decideOnProfessional(actor, parsed.data.professionalId, { decision: parsed.data.decision, reason: parsed.data.reason });
    revalidatePath(`/admin/professionnels/${parsed.data.professionalId}`);
    revalidatePath("/admin/professionnels");
    revalidatePath("/admin/moderation");
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}
