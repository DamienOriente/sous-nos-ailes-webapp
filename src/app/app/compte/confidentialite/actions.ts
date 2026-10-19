"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { createDataSubjectRequest } from "@/modules/privacy/application/dsr-service";
import { DSR_KINDS } from "@/modules/privacy/domain/dsr";

const schema = z.object({
  kind: z.enum(DSR_KINDS),
  details: z.string().trim().max(2000).optional(),
});

export type DsrFormState = ActionResult<{ id: string; dueAt: string }> | null;

export async function fileDataSubjectRequest(_prev: DsrFormState, formData: FormData): Promise<DsrFormState> {
  const parsed = schema.safeParse({ kind: formData.get("kind"), details: formData.get("details") ?? "" });
  if (!parsed.success) return { ok: false, error: "Choisissez un type de demande valide.", code: "validation" };
  try {
    const actor = await requireActorOrThrow();
    const row = await createDataSubjectRequest(actor, parsed.data);
    revalidatePath("/app/compte/confidentialite");
    return { ok: true, data: { id: row.id, dueAt: row.dueAt.toISOString() } };
  } catch (e) {
    return toActionError(e);
  }
}

/** Account deletion = erasure request handled by a person within 30 days (legal holds may apply). */
export async function requestAccountDeletion(): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const row = await createDataSubjectRequest(actor, { kind: "erasure", details: "Demande de suppression du compte depuis l'espace personnel." });
    revalidatePath("/app/compte/confidentialite");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return toActionError(e);
  }
}
