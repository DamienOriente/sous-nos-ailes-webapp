"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActorOrThrow } from "@/lib/session";
import type { FormState } from "@/components/professionals/action-form";
import { formToObject, toActionErrorWithFields, validationResult } from "@/modules/professionals/application/form-parsing";
import { replyToReview, reportReview } from "@/modules/professionals/application/review-service";

const replySchema = z.object({ professionalId: z.uuid(), reviewId: z.uuid(), replyBody: z.string().trim().min(2, "Réponse trop courte").max(1000) });
const reportSchema = z.object({ professionalId: z.uuid(), reviewId: z.uuid(), reason: z.enum(["inappropriate", "fake_review", "spam", "other"]), details: z.string().trim().max(1000).optional().default("") });

export async function replyReviewAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const parsed = replySchema.safeParse(formToObject(form));
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await replyToReview(actor, parsed.data.professionalId, parsed.data.reviewId, parsed.data.replyBody);
    revalidatePath(`/app/pro/${parsed.data.professionalId}/avis`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionErrorWithFields(e);
  }
}

export async function reportReviewAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const parsed = reportSchema.safeParse(formToObject(form));
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await reportReview(actor, parsed.data.professionalId, parsed.data.reviewId, parsed.data.reason, parsed.data.details);
    revalidatePath(`/app/pro/${parsed.data.professionalId}/avis`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionErrorWithFields(e);
  }
}
