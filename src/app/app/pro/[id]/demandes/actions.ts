"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/errors";
import { toActionError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import type { FormState } from "@/components/professionals/action-form";
import { eurosToCents, formToObject, toActionErrorWithFields, validationResult } from "@/modules/professionals/application/form-parsing";
import { inquiryQuoteSchema, inquiryReplySchema } from "@/modules/inquiries/domain/inquiry-schema";
import { INQUIRY_STATUSES, type InquiryStatus } from "@/modules/inquiries/domain/inquiry-status";
import { replyToInquiry, sendQuote, transitionInquiry } from "@/modules/inquiries/application/inquiry-service";

const idSchema = z.uuid();

export async function replyInquiryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const professionalId = idSchema.parse(form.get("professionalId"));
  const inquiryId = idSchema.parse(form.get("inquiryId"));
  const raw = formToObject(form);
  if (raw.toStatus === "") delete raw.toStatus;
  const parsed = inquiryReplySchema.safeParse(raw);
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await replyToInquiry(actor, professionalId, inquiryId, parsed.data.message, parsed.data.toStatus);
    revalidatePath(`/app/pro/${professionalId}/demandes/${inquiryId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionErrorWithFields(e);
  }
}

export async function quoteInquiryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const professionalId = idSchema.parse(form.get("professionalId"));
  const inquiryId = idSchema.parse(form.get("inquiryId"));
  const raw = formToObject(form);
  raw.quoteCents = eurosToCents(raw.quoteEuros);
  if (!raw.quoteFileId) raw.quoteFileId = null;
  const parsed = inquiryQuoteSchema.safeParse(raw);
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await sendQuote(actor, professionalId, inquiryId, { quoteCents: parsed.data.quoteCents, quoteNote: parsed.data.quoteNote || undefined, quoteFileId: parsed.data.quoteFileId ?? null, message: parsed.data.message || undefined });
    revalidatePath(`/app/pro/${professionalId}/demandes/${inquiryId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionErrorWithFields(e);
  }
}

export async function transitionInquiryAction(professionalId: string, inquiryId: string, toStatus: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    if (!(INQUIRY_STATUSES as readonly string[]).includes(toStatus)) throw new Error("invalid status");
    await transitionInquiry(actor, idSchema.parse(professionalId), idSchema.parse(inquiryId), toStatus as InquiryStatus);
    revalidatePath(`/app/pro/${professionalId}/demandes`, "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
