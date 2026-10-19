"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/errors";
import { toActionError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import type { FormState } from "@/components/professionals/action-form";
import { formToObject, toActionErrorWithFields, validationResult } from "@/modules/professionals/application/form-parsing";
import { inquiryReplySchema } from "@/modules/inquiries/domain/inquiry-schema";
import { quoteFormSchema, toStructuredQuote } from "@/modules/inquiries/domain/quote";
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

/** Lines come as line_label_i / line_qty_i / line_unit_i; empty values are dropped so the schema defaults apply. */
function quoteFormToObject(form: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  const lines: { label: string; quantity: string; unitEuros: string }[] = [];
  for (const [k, v] of form.entries()) {
    if (typeof v !== "string") continue;
    const m = /^line_(label|qty|unit)_(\d+)$/.exec(k);
    if (m) {
      const i = Number(m[2]);
      lines[i] ??= { label: "", quantity: "1", unitEuros: "0" };
      const line = lines[i];
      if (m[1] === "label") line.label = v;
      else if (m[1] === "qty") line.quantity = v || "1";
      else line.unitEuros = (v || "0").replace(",", ".");
      continue;
    }
    if (v !== "") raw[k] = k.endsWith("Euros") ? v.replace(",", ".") : v;
  }
  raw.lines = lines.filter(Boolean);
  if (!raw.quoteFileId) raw.quoteFileId = null;
  return raw;
}

export async function quoteInquiryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const professionalId = idSchema.parse(form.get("professionalId"));
  const inquiryId = idSchema.parse(form.get("inquiryId"));
  const parsed = quoteFormSchema.safeParse(quoteFormToObject(form));
  if (!parsed.success) return validationResult(parsed.error);
  try {
    const structured = toStructuredQuote(parsed.data);
    await sendQuote(actor, professionalId, inquiryId, { quoteCents: structured.totalCents, quoteFileId: parsed.data.quoteFileId ?? null, message: parsed.data.message || undefined, structured });
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
