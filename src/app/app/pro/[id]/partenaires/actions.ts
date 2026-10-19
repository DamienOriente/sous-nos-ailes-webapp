"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/professionals/action-form";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { toActionErrorWithFields } from "@/modules/professionals/application/form-parsing";
import { addRecommendation, removeRecommendation } from "@/modules/professionals/application/recommendation-service";

const schema = z.object({ professionalId: z.uuid(), recommendedId: z.uuid(), note: z.string().max(280).optional().default("") });

export async function addRecommendationAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Sélection invalide.", code: "validation" };
  try {
    await addRecommendation(actor, parsed.data.professionalId, parsed.data.recommendedId, parsed.data.note);
  } catch (e) {
    return toActionErrorWithFields(e);
  }
  revalidatePath(`/app/pro/${parsed.data.professionalId}/partenaires`);
  return { ok: true, data: undefined };
}

export async function removeRecommendationAction(professionalId: string, recommendationId: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await removeRecommendation(actor, z.uuid().parse(professionalId), z.uuid().parse(recommendationId));
    revalidatePath(`/app/pro/${professionalId}/partenaires`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
