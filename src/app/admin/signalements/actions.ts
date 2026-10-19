"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { answerReporter, decideAppeal, ensureReportCase } from "@/modules/moderation/application/report-service";

export async function ensureReportCaseAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const reportId = z.uuid().parse(formData.get("reportId"));
    const { caseId } = await ensureReportCase(actor, reportId);
    revalidatePath("/admin/signalements");
    return { ok: true, data: { redirectTo: `/admin/moderation/${caseId}` } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function answerReporterAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ reportId: z.uuid(), message: z.string().min(1).max(2000) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Réponse invalide.");
    await answerReporter(actor, parsed.data.reportId, parsed.data.message);
    revalidatePath("/admin/signalements");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function decideAppealAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ appealId: z.uuid(), outcome: z.enum(["accepted", "rejected"]), reason: z.string().min(1).max(2000) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Paramètres invalides.");
    await decideAppeal(actor, parsed.data.appealId, parsed.data.outcome, parsed.data.reason);
    revalidatePath("/admin/signalements");
    revalidatePath("/admin/moderation");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
