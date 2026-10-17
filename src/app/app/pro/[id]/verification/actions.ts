"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/errors";
import { toActionError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import type { FormState } from "@/components/professionals/action-form";
import { formToObject, toActionErrorWithFields, validationResult } from "@/modules/professionals/application/form-parsing";
import { attachDocument, declareVerification, removeDocument } from "@/modules/professionals/application/verification-service";

const declareSchema = z.object({
  professionalId: z.uuid(),
  kind: z.enum(["insurance_declared", "qualification_declared"]),
  statement: z.string().trim().min(5, "Précisez ce que vous déclarez (5 caractères minimum)").max(500),
});

export async function declareVerificationAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const parsed = declareSchema.safeParse(formToObject(form));
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await declareVerification(actor, parsed.data.professionalId, parsed.data.kind, parsed.data.statement);
    revalidatePath(`/app/pro/${parsed.data.professionalId}/verification`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionErrorWithFields(e);
  }
}

const attachSchema = z.object({ professionalId: z.uuid(), fileId: z.uuid(), kind: z.enum(["kbis_or_sirene", "insurance_certificate", "qualification", "other_supporting"]), label: z.string().trim().max(120).optional() });

export async function attachDocumentAction(input: { professionalId: string; fileId: string; kind: string; label?: string }): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = attachSchema.parse(input);
    const res = await attachDocument(actor, parsed.professionalId, { fileId: parsed.fileId, kind: parsed.kind, label: parsed.label });
    revalidatePath(`/app/pro/${parsed.professionalId}/verification`);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

export async function removeDocumentAction(professionalId: string, documentId: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await removeDocument(actor, z.uuid().parse(professionalId), z.uuid().parse(documentId));
    revalidatePath(`/app/pro/${professionalId}/verification`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
