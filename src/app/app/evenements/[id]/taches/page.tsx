import { TaskBoard } from "@/components/events/task-board";
import { PageHeader } from "@/components/shared/page-header";
import { requireActor } from "@/lib/session";
import { getEventForMember } from "@/modules/events/application/event-service";
import { listAssignableMembers, listTasks } from "@/modules/events/application/task-service";
import { toLocalDateString } from "@/modules/events/domain/event-status";
import { TASK_SUGGESTIONS } from "@/modules/events/domain/suggestions";
import { guardPage } from "../_guards";
import { addSuggestedTasksAction, addTaskCommentAction, createTaskAction, deleteTaskAction, listTaskCommentsAction, toggleTaskAction, updateTaskAction } from "./actions";

export default async function TasksPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filtre?: string; tache?: string }> }) {
  const { id } = await params;
  const { filtre, tache } = await searchParams;
  const actor = await requireActor(`/app/evenements/${id}/taches`);
  const { event, tasks, access } = await guardPage(async () => {
    const event = await getEventForMember(actor, id);
    const { tasks, access } = await listTasks(actor, id);
    return { event, tasks, access };
  });
  const members = await listAssignableMembers(id);
  const titles = new Set(tasks.map((t) => t.title.trim().toLowerCase()));
  const suggestionCount = TASK_SUGGESTIONS[event.type].filter((s) => !titles.has(s.title.toLowerCase())).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Tâches" description={access.isOrganizer ? "Votre liste de préparation, générée à partir du type d'évènement et enrichie par vos soins." : "Les tâches opérationnelles partagées avec l'équipe."} />
      <TaskBoard
        eventId={id}
        tasks={tasks.map((t) => ({ id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority, section: t.section, dueDate: t.dueDate, assigneeMemberId: t.assigneeMemberId, assigneeName: t.assigneeName, visibility: t.visibility, commentCount: t.commentCount }))}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        canManage={access.permissions.has("event.tasks.manage")}
        isOrganizer={access.isOrganizer}
        today={toLocalDateString(new Date(), event.timezone)}
        initialFilter={filtre}
        highlightTaskId={tache}
        suggestionCount={suggestionCount}
        actions={{ create: createTaskAction, update: updateTaskAction, toggle: toggleTaskAction, remove: deleteTaskAction, listComments: listTaskCommentsAction, addComment: addTaskCommentAction, addSuggested: addSuggestedTasksAction }}
      />
    </div>
  );
}
