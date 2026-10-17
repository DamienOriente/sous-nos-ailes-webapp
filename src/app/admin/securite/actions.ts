"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { EVENT_PERMISSIONS, type EventPermission } from "@/modules/authorization";
import { grantBreakGlass, revokeBreakGlass } from "@/modules/admin/application/break-glass";
import { str } from "@/app/admin/_lib/admin-page";

export async function grantBreakGlassAction(formData: FormData): Promise<ActionResult<{ expiresAt: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const grants = formData.getAll("grants").filter((g): g is string => typeof g === "string" && (EVENT_PERMISSIONS as readonly string[]).includes(g)) as EventPermission[];
    const parsed = z.object({ eventId: z.uuid(), legalReason: z.string().min(1).max(4000), durationMinutes: z.coerce.number().int() }).safeParse({ eventId: str(formData, "eventId"), legalReason: str(formData, "legalReason"), durationMinutes: str(formData, "durationMinutes") });
    if (!parsed.success) throw new ValidationError("Paramètres invalides (identifiant d'évènement, motif, durée).");
    const res = await grantBreakGlass(actor, { ...parsed.data, grants });
    revalidatePath("/admin/securite/break-glass");
    return { ok: true, data: { expiresAt: res.expiresAt.toISOString() } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function revokeBreakGlassAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await revokeBreakGlass(actor, z.uuid().parse(str(formData, "memberId")));
    revalidatePath("/admin/securite/break-glass");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
