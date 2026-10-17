"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { INVITATION_KINDS } from "@/modules/invitations/domain/state";
import {
  createInvitation,
  deleteInvitation,
  getOrCreateCheckinQr,
  getRsvpLink,
  remindInvitation,
  revokeInvitation,
  sendInvitation,
  updateInvitation,
  type QrPayload,
} from "@/modules/invitations/application/invitation-service";

const uuid = z.string().uuid();
const path = (eventId: string, invitationId?: string) => `/app/evenements/${eventId}/invitations${invitationId ? `/${invitationId}` : ""}`;

const invitationSchema = z.object({
  kind: z.enum(INVITATION_KINDS),
  templateKey: z.string().min(1).max(30),
  recipientName: z.string().trim().min(1, "Le nom du destinataire est requis.").max(120),
  recipientEmail: z.string().trim().max(200).optional().nullable(),
  customMessage: z.string().trim().max(2000).optional().nullable(),
  guestIds: z.array(uuid).max(50).default([]),
  groupId: z.string().optional().nullable(),
  showDate: z.boolean().default(true),
  showVenue: z.boolean().default(true),
});
export type InvitationFormValues = z.input<typeof invitationSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Données invalides.");
  return r.data;
}

export async function createInvitationAction(eventId: string, input: InvitationFormValues): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    const v = parse(invitationSchema, input);
    const row = await createInvitation(actor, id, { ...v, groupId: v.groupId || null });
    revalidatePath(path(id));
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateInvitationAction(eventId: string, invitationId: string, input: Omit<InvitationFormValues, "kind" | "guestIds" | "groupId">): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    const inv = parse(uuid, invitationId);
    const v = parse(invitationSchema.omit({ kind: true, guestIds: true, groupId: true }), input);
    const row = await updateInvitation(actor, id, inv, v);
    revalidatePath(path(id, inv));
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return toActionError(e);
  }
}

async function simple(eventId: string, invitationId: string, fn: (actor: Awaited<ReturnType<typeof requireActorOrThrow>>, id: string, inv: string) => Promise<unknown>): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    const inv = parse(uuid, invitationId);
    await fn(actor, id, inv);
    revalidatePath(path(id));
    revalidatePath(path(id, inv));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function sendInvitationAction(eventId: string, invitationId: string): Promise<ActionResult> {
  return simple(eventId, invitationId, (a, e, i) => sendInvitation(a, e, i));
}
export async function remindInvitationAction(eventId: string, invitationId: string): Promise<ActionResult> {
  return simple(eventId, invitationId, (a, e, i) => remindInvitation(a, e, i));
}
export async function revokeInvitationAction(eventId: string, invitationId: string): Promise<ActionResult> {
  return simple(eventId, invitationId, (a, e, i) => revokeInvitation(a, e, i));
}
export async function deleteInvitationAction(eventId: string, invitationId: string): Promise<ActionResult> {
  return simple(eventId, invitationId, (a, e, i) => deleteInvitation(a, e, i));
}

export async function getRsvpLinkAction(eventId: string, invitationId: string): Promise<ActionResult<{ url: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const url = await getRsvpLink(actor, parse(uuid, eventId), parse(uuid, invitationId));
    return { ok: true, data: { url } };
  } catch (e) {
    return toActionError(e);
  }
}

/** Generates (or returns) the single-use check-in QR as a data URL. Premium only. */
export async function generateQrAction(eventId: string, invitationId: string, regenerate = false): Promise<ActionResult<QrPayload>> {
  try {
    const actor = await requireActorOrThrow();
    const qr = await getOrCreateCheckinQr(actor, parse(uuid, eventId), parse(uuid, invitationId), { regenerate: Boolean(regenerate) });
    revalidatePath(path(eventId, invitationId));
    return { ok: true, data: qr };
  } catch (e) {
    return toActionError(e);
  }
}
