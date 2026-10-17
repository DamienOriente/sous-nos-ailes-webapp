"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActorOrThrow } from "@/lib/session";
import type { FormState } from "@/components/professionals/action-form";
import { toActionErrorWithFields } from "@/modules/professionals/application/form-parsing";
import { replaceAvailability } from "@/modules/professionals/application/availability-service";

const idSchema = z.uuid();

export async function saveAvailabilityAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const professionalId = idSchema.parse(form.get("professionalId"));
  const slots = form
    .getAll("slot")
    .map(String)
    .map((v) => v.split("-").map(Number))
    .filter((p) => p.length === 3 && p.every((n) => Number.isInteger(n)))
    .map(([weekday, startMinute, endMinute]) => ({ weekday, startMinute, endMinute }));
  try {
    await replaceAvailability(actor, professionalId, slots);
    revalidatePath(`/app/pro/${professionalId}/disponibilites`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionErrorWithFields(e);
  }
}
