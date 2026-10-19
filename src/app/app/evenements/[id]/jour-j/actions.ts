"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { chainStepsInOrder, reportDelay, setDependency, setLiveStatus } from "@/modules/events/application/live-day-service";

const ids = z.object({ eventId: z.uuid(), milestoneId: z.uuid() });

async function run(eventId: string, fn: () => Promise<unknown>): Promise<ActionResult<undefined>> {
  try {
    await fn();
    revalidatePath(`/app/evenements/${eventId}/jour-j`);
    revalidatePath(`/app/evenements/${eventId}/planning`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function reportDelayAction(eventId: string, milestoneId: string, minutes: number): Promise<ActionResult<undefined>> {
  return run(eventId, async () => {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, milestoneId });
    await reportDelay(actor, p.eventId, p.milestoneId, z.number().int().parse(minutes));
  });
}

export async function setLiveStatusAction(eventId: string, milestoneId: string, status: "in_progress" | "done"): Promise<ActionResult<undefined>> {
  return run(eventId, async () => {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, milestoneId });
    await setLiveStatus(actor, p.eventId, p.milestoneId, z.enum(["in_progress", "done"]).parse(status));
  });
}

export async function setDependencyAction(eventId: string, milestoneId: string, dependsOnId: string): Promise<ActionResult<undefined>> {
  return run(eventId, async () => {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, milestoneId });
    await setDependency(actor, p.eventId, p.milestoneId, dependsOnId ? z.uuid().parse(dependsOnId) : null);
  });
}

export async function chainStepsAction(eventId: string): Promise<ActionResult<undefined>> {
  return run(eventId, async () => {
    const actor = await requireActorOrThrow();
    await chainStepsInOrder(actor, z.uuid().parse(eventId));
  });
}
