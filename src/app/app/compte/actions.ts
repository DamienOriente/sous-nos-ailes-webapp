"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { updateProfile } from "@/modules/identity/application/profile-service";
import { profileSchema } from "@/modules/identity/domain/profile";

export type ProfileFormState = ActionResult<{ savedAt: number }> | null;

export async function updateProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone") ?? "",
    city: formData.get("city") ?? "",
    postalCode: formData.get("postalCode") ?? "",
    timezone: formData.get("timezone"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    return { ok: false, error: "Vérifiez les champs en rouge.", code: "validation", fieldErrors: Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v ?? []])) };
  }
  try {
    const actor = await requireActorOrThrow();
    await updateProfile(actor, parsed.data);
    revalidatePath("/app", "layout");
    return { ok: true, data: { savedAt: Date.now() } };
  } catch (e) {
    return toActionError(e);
  }
}
