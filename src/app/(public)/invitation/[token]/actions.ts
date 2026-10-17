"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { submitPublicRsvp } from "@/modules/invitations/application/invitation-service";

const schema = z.object({
  status: z.enum(["accepted", "declined", "maybe"]),
  guestsCount: z.number().int().min(0).max(50),
  message: z.string().trim().max(1000).optional().nullable(),
  perGuest: z.record(z.string().uuid(), z.enum(["accepted", "declined"])).optional(),
});
export type RsvpFormValues = z.input<typeof schema>;

/** Public, unauthenticated: the token is the credential. Rate-limited per IP in the service. */
export async function submitRsvpAction(token: string, input: RsvpFormValues): Promise<ActionResult> {
  try {
    const t = z.string().min(16).max(200).regex(/^[A-Za-z0-9_-]+$/).safeParse(token);
    if (!t.success) throw new ValidationError("Lien invalide.");
    const v = schema.safeParse(input);
    if (!v.success) throw new ValidationError(v.error.issues[0]?.message ?? "Réponse invalide.");
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0]?.trim() || null;
    await submitPublicRsvp(t.data, v.data, ip);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
