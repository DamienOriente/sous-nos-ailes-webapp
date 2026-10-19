"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/professionals/action-form";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { updateBrief } from "@/modules/events/application/brief-service";
import { briefUpdateSchema, sendBriefSchema } from "@/modules/events/domain/brief";
import { sendBriefToProfessionals } from "@/modules/inquiries/application/inquiry-service";
import { toActionErrorWithFields, validationResult } from "@/modules/professionals/application/form-parsing";

const idSchema = z.uuid();

export async function updateBriefAction(eventId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const id = idSchema.parse(eventId);
  const raw = Object.fromEntries(form);
  const parsed = briefUpdateSchema.safeParse({ ...raw, briefShareBudget: form.get("briefShareBudget") === "on", expectedGuests: raw.expectedGuests || null, expectedChildren: raw.expectedChildren || null, budgetEuros: raw.budgetEuros || null });
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await updateBrief(actor, id, parsed.data);
  } catch (e) {
    return toActionErrorWithFields(e);
  }
  revalidatePath(`/app/evenements/${id}`, "layout");
  return { ok: true, data: undefined };
}

export async function sendBriefAction(eventId: string, input: { professionalIds: string[]; kind: string; message: string }): Promise<ActionResult<{ sent: number; skipped: number }>> {
  try {
    const actor = await requireActorOrThrow();
    const id = idSchema.parse(eventId);
    const parsed = sendBriefSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Sélection invalide.");
    const res = await sendBriefToProfessionals(actor, id, parsed.data);
    revalidatePath(`/app/evenements/${id}/brief`);
    revalidatePath(`/app/evenements/${id}/demandes`);
    return { ok: true, data: { sent: res.sent.length, skipped: res.skipped.length } };
  } catch (e) {
    return toActionError(e);
  }
}
