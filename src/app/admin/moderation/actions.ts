"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { DECISIONS } from "@/modules/moderation/domain/decisions";
import { assignCase, decideCase, reviewDocument, reviewVerification } from "@/modules/moderation/application/moderation-service";
import { hideReportedMessage, moderateReview } from "@/modules/moderation/application/content-moderation";
import { VERIFICATION_KINDS } from "@/modules/professionals/domain/verification";
import { str } from "@/app/admin/_lib/admin-page";

function revalidate(caseId?: string) {
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/professionnels");
  revalidatePath("/admin/signalements");
  if (caseId) revalidatePath(`/admin/moderation/${caseId}`);
}

export async function decideCaseAction(formData: FormData): Promise<ActionResult<unknown>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ caseId: z.uuid(), decision: z.enum(DECISIONS), reason: z.string().min(1).max(2000) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Décision ou motif invalide.");
    const res = await decideCase(actor, parsed.data.caseId, { decision: parsed.data.decision, reason: parsed.data.reason });
    revalidate(parsed.data.caseId);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

export async function assignCaseAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const caseId = z.uuid().parse(str(formData, "caseId"));
    const assignee = str(formData, "assigneeUserId");
    await assignCase(actor, caseId, assignee === "" || assignee === "none" ? null : assignee);
    revalidate(caseId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function reviewVerificationAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z
      .object({ professionalId: z.uuid(), kind: z.enum(VERIFICATION_KINDS), status: z.enum(["verified", "rejected"]), statement: z.string().min(1).max(500), validUntil: z.string().optional(), caseId: z.string().optional() })
      .safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Vérification invalide.");
    const validUntil = parsed.data.validUntil ? new Date(parsed.data.validUntil) : null;
    await reviewVerification(actor, parsed.data.professionalId, parsed.data.kind, parsed.data.status, parsed.data.statement, validUntil && !Number.isNaN(validUntil.getTime()) ? validUntil : null);
    revalidate(parsed.data.caseId || undefined);
    revalidatePath(`/admin/professionnels/${parsed.data.professionalId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function reviewDocumentAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ documentId: z.uuid(), status: z.enum(["verified", "rejected"]), note: z.string().max(500).optional().default(""), caseId: z.string().optional(), professionalId: z.string().optional() }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Document invalide.");
    await reviewDocument(actor, parsed.data.documentId, parsed.data.status, parsed.data.note);
    revalidate(parsed.data.caseId || undefined);
    if (parsed.data.professionalId) revalidatePath(`/admin/professionnels/${parsed.data.professionalId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function moderateReviewAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ reviewId: z.uuid(), status: z.enum(["published", "hidden", "rejected"]), note: z.string().max(1000).optional().default("") }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Paramètres invalides.");
    await moderateReview(actor, parsed.data.reviewId, parsed.data.status, parsed.data.note);
    revalidatePath("/admin/moderation/avis");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function hideMessageAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ messageId: z.uuid(), reason: z.string().min(1).max(1000) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Paramètres invalides.");
    await hideReportedMessage(actor, parsed.data.messageId, parsed.data.reason);
    revalidatePath(`/admin/moderation/messages/${parsed.data.messageId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
