"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { addSuggestedMilestones, createMilestone, deleteMilestone, updateMilestone } from "@/modules/events/application/milestone-service";

function revalidate(eventId: string) {
  revalidatePath(`/app/evenements/${eventId}/planning`);
  revalidatePath(`/app/evenements/${eventId}`);
}

export async function createMilestoneAction(eventId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const res = await createMilestone(actor, z.uuid().parse(eventId), input);
    revalidate(eventId);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateMilestoneAction(eventId: string, milestoneId: string, input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await updateMilestone(actor, z.uuid().parse(eventId), z.uuid().parse(milestoneId), input);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteMilestoneAction(eventId: string, milestoneId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteMilestone(actor, z.uuid().parse(eventId), z.uuid().parse(milestoneId));
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addSuggestedMilestonesAction(eventId: string): Promise<ActionResult<{ created: number }>> {
  try {
    const actor = await requireActorOrThrow();
    const res = await addSuggestedMilestones(actor, z.uuid().parse(eventId));
    revalidate(eventId);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}
