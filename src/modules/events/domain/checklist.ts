/**
 * Builds the initial task list of an event from checklist templates. Pure.
 * dueDate = eventDate - dueDaysBefore (only when the date is known). Items
 * whose due date is already past are kept but flagged so the UI can group them.
 */
export type ChecklistTemplateInput = { section: string; title: string; description: string | null; dueDaysBefore: number | null; sortOrder: number };

export type GeneratedTask = {
  section: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  sortOrder: number;
  visibility: "organizers" | "team";
};

/** Sections whose tasks are operational and useful to providers too. */
const TEAM_SECTIONS = new Set(["Dernière ligne droite"]);

export function addDays(isoDate: string, days: number): string {
  const d = new Date(Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10))));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildChecklist(templates: readonly ChecklistTemplateInput[], eventDate: string | null): GeneratedTask[] {
  return [...templates]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      section: t.section,
      title: t.title,
      description: t.description,
      dueDate: eventDate && t.dueDaysBefore !== null ? addDays(eventDate, -t.dueDaysBefore) : null,
      sortOrder: t.sortOrder,
      visibility: TEAM_SECTIONS.has(t.section) ? "team" : "organizers",
    }));
}

export type TaskLike = { status: "todo" | "in_progress" | "done" | "cancelled"; dueDate: string | null };

export function isTaskOverdue(task: TaskLike, today: string): boolean {
  return (task.status === "todo" || task.status === "in_progress") && task.dueDate !== null && task.dueDate < today;
}

export function isTaskOpen(task: TaskLike): boolean {
  return task.status === "todo" || task.status === "in_progress";
}
