"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { addTaskComment, createTask, deleteTask, listTaskComments, toggleTask, updateTask } from "@/modules/events/application/task-service";

const ids = z.object({ eventId: z.uuid(), taskId: z.uuid() });

function revalidate(eventId: string) {
  revalidatePath(`/app/evenements/${eventId}/taches`);
  revalidatePath(`/app/evenements/${eventId}`);
}

export async function createTaskAction(eventId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const res = await createTask(actor, z.uuid().parse(eventId), input);
    revalidate(eventId);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateTaskAction(eventId: string, taskId: string, input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, taskId });
    await updateTask(actor, p.eventId, p.taskId, input);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleTaskAction(eventId: string, taskId: string, done: boolean): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, taskId });
    await toggleTask(actor, p.eventId, p.taskId, Boolean(done));
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteTaskAction(eventId: string, taskId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, taskId });
    await deleteTask(actor, p.eventId, p.taskId);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export type TaskComment = { id: string; body: string; createdAt: string; authorName: string; authorUserId: string };

export async function listTaskCommentsAction(eventId: string, taskId: string): Promise<ActionResult<TaskComment[]>> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, taskId });
    const rows = await listTaskComments(actor, p.eventId, p.taskId);
    return { ok: true, data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addTaskCommentAction(eventId: string, taskId: string, body: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const p = ids.parse({ eventId, taskId });
    await addTaskComment(actor, p.eventId, p.taskId, String(body ?? ""));
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
