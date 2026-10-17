export const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = { todo: "À faire", in_progress: "En cours", done: "Fait", cancelled: "Annulée" };
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = { low: "Basse", normal: "Normale", high: "Haute", urgent: "Urgente" };
