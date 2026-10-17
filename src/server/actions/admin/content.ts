"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionUser } from "@/server/authz";
import { updateContent } from "@/server/services/settings";
import { normalizeText } from "@/lib/sanitize";
import { type FormState, actionMessageFor, formErrorState, formSuccessState, validationErrorState } from "@/server/actions/admin/helpers";

const contentSchema = z.object({
  body: z.string().max(20_000, { error: "20 000 caractères maximum." }).transform((v) => normalizeText(v)),
});

/** Plain text only; paragraphs are separated by a blank line and rendered by the public pages. */
export async function updateContentAction(key: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireActionUser(["ADMIN"]);
    const parsed = contentSchema.safeParse({ body: formData.get("body") ?? "" });
    if (!parsed.success) return validationErrorState(parsed.error, formData);
    await updateContent(key, parsed.data.body);
    revalidatePath("/admin/contenus");
    revalidatePath("/", "layout");
    return formSuccessState("Texte enregistré.");
  } catch (error) {
    return formErrorState(actionMessageFor(error), formData);
  }
}
