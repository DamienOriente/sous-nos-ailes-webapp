"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/professionals/action-form";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { formToObject, toActionErrorWithFields, validationResult } from "@/modules/professionals/application/form-parsing";
import { requestAgencyStatus, setPrimaryListing } from "@/modules/professionals/application/agency-service";
import { agencyRequestSchema } from "@/modules/professionals/domain/agency-schema";

export async function requestAgencyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const parsed = agencyRequestSchema.safeParse(formToObject(form));
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await requestAgencyStatus(actor, parsed.data);
  } catch (e) {
    return toActionErrorWithFields(e);
  }
  revalidatePath("/app/pro", "layout");
  return { ok: true, data: undefined };
}

export async function setPrimaryListingAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const id = z.uuid().safeParse(formData.get("professionalId"));
    if (!id.success) throw new ValidationError();
    await setPrimaryListing(actor, id.data);
    revalidatePath("/app/pro");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
