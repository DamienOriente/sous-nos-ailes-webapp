import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { eventMembers, eventTaskComments, eventTasks, users } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission, type EventAccess } from "@/modules/authorization";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/modules/events/domain/task-labels";
import { notify } from "@/modules/notifications/application/notification-service";

export { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUSES } from "@/modules/events/domain/task-labels";

export const taskSchema = z.object({
  title: z.string().trim().min(2, "Titre trop court.").max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  section: z.string().trim().max(80).nullable().optional(),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  assigneeMemberId: z.uuid().nullable().optional(),
  visibility: z.enum(["organizers", "team"]).default("organizers"),
});
export type TaskInput = z.infer<typeof taskSchema>;

export type TaskRow = typeof eventTasks.$inferSelect & { assigneeName: string | null; commentCount: number };

function visibilityFilter(access: EventAccess, eventId: string) {
  return access.isOrganizer ? eq(eventTasks.eventId, eventId) : and(eq(eventTasks.eventId, eventId), eq(eventTasks.visibility, "team"));
}

export async function listTasks(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<{ tasks: TaskRow[]; access: EventAccess }> {
  const access = await requireEventPermission(actor, eventId, "event.tasks.view", executor);
  const rows = await executor
    .select({
      task: eventTasks,
      assigneeName: users.name,
      commentCount: sql<number>`(select count(*) from event_task_comments c where c.task_id = ${eventTasks.id})::int`,
    })
    .from(eventTasks)
    .leftJoin(eventMembers, eq(eventMembers.id, eventTasks.assigneeMemberId))
    .leftJoin(users, eq(users.id, eventMembers.userId))
    .where(visibilityFilter(access, eventId))
    .orderBy(asc(eventTasks.sortOrder), asc(eventTasks.dueDate), asc(eventTasks.createdAt));
  return { tasks: rows.map((r) => ({ ...r.task, assigneeName: r.assigneeName, commentCount: r.commentCount })), access };
}

async function loadTask(access: EventAccess, eventId: string, taskId: string, executor: DbExecutor) {
  const [t] = await executor
    .select()
    .from(eventTasks)
    .where(and(eq(eventTasks.id, taskId), visibilityFilter(access, eventId)))
    .limit(1);
  if (!t) throw new NotFoundError();
  return t;
}

async function assertAssignee(eventId: string, memberId: string | null | undefined, executor: DbExecutor) {
  if (!memberId) return;
  const [m] = await executor.select({ id: eventMembers.id }).from(eventMembers).where(and(eq(eventMembers.id, memberId), eq(eventMembers.eventId, eventId), eq(eventMembers.status, "active"))).limit(1);
  if (!m) throw new ValidationError("Le membre assigné n'appartient pas à cet évènement.");
}

async function notifyAssignee(eventId: string, memberId: string | null | undefined, actor: Actor, title: string, taskId: string, executor: DbExecutor) {
  if (!memberId) return;
  const [m] = await executor.select({ userId: eventMembers.userId }).from(eventMembers).where(eq(eventMembers.id, memberId)).limit(1);
  if (!m || m.userId === actor.userId) return;
  await notify(
    { userId: m.userId, type: "deadline", title: "Une tâche vous a été assignée", body: title, href: `/app/evenements/${eventId}/taches?tache=${taskId}`, eventId, dedupeKey: `task-assigned:${taskId}:${m.userId}` },
    executor,
  );
}

export async function createTask(actor: Actor, eventId: string, raw: unknown, executor: DbExecutor = db): Promise<{ id: string }> {
  const access = await requireEventPermission(actor, eventId, "event.tasks.manage", executor);
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Tâche invalide.", { issues: parsed.error.issues });
  const input = parsed.data;
  // Providers/collaborators can only create operational (team) tasks.
  const visibility = access.isOrganizer ? input.visibility : "team";
  await assertAssignee(eventId, input.assigneeMemberId, executor);
  const [maxRow] = await executor.select({ m: sql<number>`coalesce(max(sort_order),0)::int` }).from(eventTasks).where(eq(eventTasks.eventId, eventId));
  const [row] = await executor
    .insert(eventTasks)
    .values({
      eventId,
      title: input.title,
      description: input.description ?? null,
      section: input.section || "Autres",
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate ?? null,
      assigneeMemberId: input.assigneeMemberId ?? null,
      visibility,
      sortOrder: (maxRow?.m ?? 0) + 10,
      completedAt: input.status === "done" ? new Date() : null,
      createdByUserId: actor.userId,
    })
    .returning({ id: eventTasks.id });
  if (!row) throw new Error("task insert failed");
  await notifyAssignee(eventId, input.assigneeMemberId, actor, input.title, row.id, executor);
  return row;
}

export async function updateTask(actor: Actor, eventId: string, taskId: string, raw: unknown, executor: DbExecutor = db): Promise<void> {
  const access = await requireEventPermission(actor, eventId, "event.tasks.manage", executor);
  const current = await loadTask(access, eventId, taskId, executor);
  const parsed = taskSchema.partial().safeParse(raw);
  if (!parsed.success) throw new ValidationError("Tâche invalide.", { issues: parsed.error.issues });
  const input = parsed.data;
  if (input.assigneeMemberId !== undefined) await assertAssignee(eventId, input.assigneeMemberId, executor);
  const status = input.status ?? current.status;
  await executor
    .update(eventTasks)
    .set({
      title: input.title ?? current.title,
      description: input.description === undefined ? current.description : input.description,
      section: input.section === undefined ? current.section : input.section || "Autres",
      status,
      priority: input.priority ?? current.priority,
      dueDate: input.dueDate === undefined ? current.dueDate : input.dueDate,
      assigneeMemberId: input.assigneeMemberId === undefined ? current.assigneeMemberId : input.assigneeMemberId,
      visibility: access.isOrganizer ? (input.visibility ?? current.visibility) : current.visibility,
      completedAt: status === "done" ? (current.completedAt ?? new Date()) : null,
    })
    .where(eq(eventTasks.id, taskId));
  if (input.assigneeMemberId && input.assigneeMemberId !== current.assigneeMemberId) {
    await notifyAssignee(eventId, input.assigneeMemberId, actor, input.title ?? current.title, taskId, executor);
  }
}

export async function toggleTask(actor: Actor, eventId: string, taskId: string, done: boolean, executor: DbExecutor = db): Promise<void> {
  const access = await requireEventPermission(actor, eventId, "event.tasks.manage", executor);
  await loadTask(access, eventId, taskId, executor);
  await executor
    .update(eventTasks)
    .set({ status: done ? "done" : "todo", completedAt: done ? new Date() : null })
    .where(eq(eventTasks.id, taskId));
}

export async function deleteTask(actor: Actor, eventId: string, taskId: string, executor: DbExecutor = db): Promise<void> {
  const access = await requireEventPermission(actor, eventId, "event.tasks.manage", executor);
  await loadTask(access, eventId, taskId, executor);
  await executor.delete(eventTasks).where(eq(eventTasks.id, taskId));
}

export async function listTaskComments(actor: Actor, eventId: string, taskId: string, executor: DbExecutor = db) {
  const access = await requireEventPermission(actor, eventId, "event.tasks.view", executor);
  await loadTask(access, eventId, taskId, executor);
  return executor
    .select({ id: eventTaskComments.id, body: eventTaskComments.body, createdAt: eventTaskComments.createdAt, authorName: users.name, authorUserId: eventTaskComments.authorUserId })
    .from(eventTaskComments)
    .innerJoin(users, eq(users.id, eventTaskComments.authorUserId))
    .where(eq(eventTaskComments.taskId, taskId))
    .orderBy(asc(eventTaskComments.createdAt));
}

export async function addTaskComment(actor: Actor, eventId: string, taskId: string, body: string, executor: DbExecutor = db): Promise<void> {
  const access = await requireEventPermission(actor, eventId, "event.tasks.view", executor);
  const task = await loadTask(access, eventId, taskId, executor);
  const text = body.trim();
  if (text.length < 1 || text.length > 2000) throw new ValidationError("Commentaire vide ou trop long.");
  await executor.insert(eventTaskComments).values({ taskId, authorUserId: actor.userId, body: text });
  if (task.assigneeMemberId) await notifyAssignee(eventId, task.assigneeMemberId, actor, `Nouveau commentaire : ${task.title}`, taskId, executor);
}

export async function listAssignableMembers(eventId: string, executor: DbExecutor = db) {
  return executor
    .select({ id: eventMembers.id, name: users.name, role: eventMembers.role, userId: eventMembers.userId })
    .from(eventMembers)
    .innerJoin(users, eq(users.id, eventMembers.userId))
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, "active")))
    .orderBy(asc(users.name));
}

/** Rows for the CSV export (organiser view). */
export async function tasksForExport(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const { tasks } = await listTasks(actor, eventId, executor);
  return tasks;
}

