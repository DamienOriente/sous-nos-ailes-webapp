"use server";
import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { updateSetting } from "@/modules/admin/application/settings-service";
import { str } from "@/app/admin/_lib/admin-page";

export async function updateSettingAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const key = str(formData, "key");
    const raw = formData.has("value") ? str(formData, "value") : "false";
    await updateSetting(actor, key, raw);
    revalidatePath("/admin/parametres");
    revalidatePath("/tarifs");
    revalidatePath("/classements-sponsorises");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
