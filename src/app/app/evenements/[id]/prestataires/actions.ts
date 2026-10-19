"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { changeProviderStatus, createExternalProvider, deleteProvider, inviteMember, revokeInvitation, updateProvider } from "@/modules/events/application/provider-service";
import { revokeMember } from "@/modules/events/application/member-service";
import type { ProviderStatus } from "@/modules/events/domain/providers";

function revalidate(eventId: string) {
  revalidatePath(`/app/evenements/${eventId}/prestataires`);
  revalidatePath(`/app/evenements/${eventId}/budget`);
  revalidatePath(`/app/evenements/${eventId}/equipe`);
  revalidatePath(`/app/evenements/${eventId}`);
}

export async function createExternalProviderAction(eventId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const res = await createExternalProvider(actor, z.uuid().parse(eventId), input);
    revalidate(eventId);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateProviderAction(eventId: string, providerId: string, input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await updateProvider(actor, z.uuid().parse(eventId), z.uuid().parse(providerId), input);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function changeProviderStatusAction(eventId: string, providerId: string, to: ProviderStatus): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await changeProviderStatus(actor, z.uuid().parse(eventId), z.uuid().parse(providerId), to);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteProviderAction(eventId: string, providerId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteProvider(actor, z.uuid().parse(eventId), z.uuid().parse(providerId));
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function inviteProviderAction(eventId: string, input: unknown): Promise<ActionResult<{ invitationId: string; expiresAt: string }>> {
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

export async function revokeProviderAccessAction(eventId: string, memberId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await revokeMember(actor, z.uuid().parse(eventId), z.uuid().parse(memberId), "Accès prestataire révoqué depuis la fiche.");
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
