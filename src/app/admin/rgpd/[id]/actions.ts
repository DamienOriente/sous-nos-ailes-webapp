"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { updateDataSubjectRequestStatus } from "@/modules/privacy/application/dsr-service";
import { DSR_STATUSES } from "@/modules/privacy/domain/dsr";

const schema = z.object({ id: z.uuid(), status: z.enum(DSR_STATUSES), reason: z.string().trim().max(2000).optional() });

export type DsrStatusFormState = ActionResult<undefined> | null;

export async function changeDsrStatus(_prev: DsrStatusFormState, formData: FormData): Promise<DsrStatusFormState> {
  const parsed = schema.safeParse({ id: formData.get("id"), status: formData.get("status"), reason: formData.get("reason") ?? "" });
  if (!parsed.success) return { ok: false, error: "Statut ou identifiant invalide.", code: "validation" };
  try {
    const actor = await requireActorOrThrow();
    await updateDataSubjectRequestStatus(actor, parsed.data.id, parsed.data.status, parsed.data.reason ?? null);
    revalidatePath("/admin/rgpd");
    revalidatePath(`/admin/rgpd/${parsed.data.id}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
