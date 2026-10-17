"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { changeMemberRole, leaveEvent, removeMemberPermission, revokeMember, setMemberPermission, transferOwnership } from "@/modules/events/application/member-service";
import { inviteMember, revokeInvitation } from "@/modules/events/application/provider-service";

const ids = z.object({ eventId: z.uuid(), memberId: z.uuid() });

function revalidate(eventId: string) {
  revalidatePath(`/app/evenements/${eventId}/equipe`);
  revalidatePath(`/app/evenements/${eventId}`);
}

export async function inviteCollaboratorAction(eventId: string, input: unknown): Promise<ActionResult<{ invitationId: string; expiresAt: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const res = await inviteMember(actor, z.uuid().parse(eventId), input);
    revalidate(eventId);
    return { ok: true, data: { invitationId: res.invitationId, expiresAt: res.expiresAt.toISOString() } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function revokeInvitationAction(eventId: string, invitationId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await revokeInvitation(actor, z.uuid().parse(eventId), z.uuid().parse(invitationId));
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function changeRoleAction(eventId: string, memberId: string, input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, memberId });
    await changeMemberRole(actor, p.eventId, p.memberId, input);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function revokeMemberAction(eventId: string, memberId: string, reason?: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, memberId });
    await revokeMember(actor, p.eventId, p.memberId, reason ?? null);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function leaveEventAction(eventId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await leaveEvent(actor, z.uuid().parse(eventId));
    revalidatePath("/app/evenements");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function transferOwnershipAction(eventId: string, memberId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, memberId });
    await transferOwnership(actor, p.eventId, p.memberId);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setPermissionAction(eventId: string, memberId: string, input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, memberId });
    await setMemberPermission(actor, p.eventId, p.memberId, input);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function removePermissionAction(eventId: string, memberId: string, permission: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, memberId });
    await removeMemberPermission(actor, p.eventId, p.memberId, String(permission));
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
