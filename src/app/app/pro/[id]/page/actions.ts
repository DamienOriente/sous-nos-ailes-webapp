"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { saveDraft, submitForReview } from "@/modules/pages/application/page-service";
import { pageContentSchema, seoFieldsSchema, themeSchema } from "@/modules/pages/domain/page-schema";

/**
 * Builder actions: thin validation + service call. The content itself is
 * re-validated by the service with the block schema (defence in depth).
 */
const saveSchema = z.object({
  professionalId: z.uuid(),
  templateKey: z.string().regex(/^[a-z0-9-]{2,40}$/).optional(),
  theme: themeSchema.optional(),
  content: z.unknown().optional(),
  seoTitle: z.string().max(70).nullable().optional(),
  seoDescription: z.string().max(170).nullable().optional(),
});

export type SaveDraftResult = { versionId: string; versionNumber: number; savedAt: string };

export async function saveDraftAction(input: z.infer<typeof saveSchema>): Promise<ActionResult<SaveDraftResult>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Données invalides.");
    if (parsed.data.content !== undefined) {
      const c = pageContentSchema.safeParse(parsed.data.content);
      if (!c.success) throw new ValidationError("Contenu de page invalide.", { issues: c.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
    }
    if (parsed.data.seoTitle !== undefined || parsed.data.seoDescription !== undefined) {
      const s = seoFieldsSchema.safeParse({ seoTitle: parsed.data.seoTitle, seoDescription: parsed.data.seoDescription });
      if (!s.success) throw new ValidationError("Champs SEO invalides.");
    }
    const { professionalId, ...patch } = parsed.data;
    const data = await saveDraft(actor, professionalId, patch);
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}

export async function submitForReviewAction(professionalId: string): Promise<ActionResult<{ versionId: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const id = z.uuid().safeParse(professionalId);
    if (!id.success) throw new ValidationError();
    const res = await submitForReview(actor, id.data);
    revalidatePath(`/app/pro/${id.data}/page`);
    revalidatePath(`/app/pro/${id.data}`);
    return { ok: true, data: { versionId: res.versionId } };
  } catch (e) {
    return toActionError(e);
  }
}
