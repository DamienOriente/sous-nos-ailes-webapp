"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { confirmHold, placeHold, releaseHold } from "@/modules/inquiries/application/hold-service";

const placeSchema = z.object({ professionalId: z.uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date"), eventId: z.uuid().optional().nullable() });

/** Organiser places a 48-hour option (public page, brief page). */
export async function placeHoldAction(input: { professionalId: string; date: string; eventId?: string | null }): Promise<ActionResult<{ expiresAt: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = placeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides.", code: "validation" };
    const hold = await placeHold(actor, parsed.data);
    if (hold.eventId) revalidatePath(`/app/evenements/${hold.eventId}/demandes`);
    return { ok: true, data: { expiresAt: hold.expiresAt.toISOString() } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function releaseHoldAction(holdId: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await releaseHold(actor, z.uuid().parse(holdId));
    revalidatePath("/app", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function confirmHoldAction(holdId: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await confirmHold(actor, z.uuid().parse(holdId));
    revalidatePath("/app", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
