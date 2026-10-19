"use server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/professionals/action-form";
import { requireActorOrThrow } from "@/lib/session";
import { formToObject, toActionErrorWithFields, validationResult } from "@/modules/professionals/application/form-parsing";
import { createVerifiedReview } from "@/modules/professionals/application/review-service";
import { reviewInputSchema } from "@/modules/professionals/domain/review-eligibility";

export async function createReviewAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const raw = formToObject(form);
  if (!raw.eventId) delete raw.eventId;
  if (!raw.inquiryId) delete raw.inquiryId;
  const parsed = reviewInputSchema.safeParse(raw);
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await createVerifiedReview(actor, parsed.data);
  } catch (e) {
    return toActionErrorWithFields(e);
  }
  revalidatePath("/app/avis");
  return { ok: true, data: undefined };
}
