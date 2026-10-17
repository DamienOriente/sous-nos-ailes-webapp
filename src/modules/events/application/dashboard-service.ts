import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { channelMembers, eventBudgetLines, eventChannels, eventChildren, eventExpenses, eventProfessionals, eventTasks, invitations, messages, professionalCategories, users } from "@/db/schema";
import type { Actor } from "@/lib/session";
import { computeAlerts, type Alert } from "@/modules/events/domain/alerts";
import { computeBudgetSummary, type BudgetSummary } from "@/modules/events/domain/budget";
import { isTaskOpen, isTaskOverdue } from "@/modules/events/domain/checklist";
import { daysUntil, toLocalDateString } from "@/modules/events/domain/event-status";
import { getEventWithPermission, wantedCategories, type EventSummary } from "@/modules/events/application/event-service";

export type EventDashboard = {
  event: EventSummary;
  daysUntil: number | null;
  providers: { confirmed: number; pending: number; total: number };
  tasks: { open: number; overdue: number; done: number; total: number };
  budget: BudgetSummary | null;
  invitations: { sent: number; answered: number } | null;
  childrenCount: number | null;
  unreadMessages: number;
  alerts: Alert[];
  upcomingTasks: Array<{ id: string; title: string; dueDate: string | null; section: string | null; status: string }>;
  recentMessages: Array<{ id: string; body: string; authorName: string; channelName: string; channelId: string; createdAt: Date }>;
  pendingValidations: Array<{ id: string; label: string; status: string; categoryName: string | null; quoteCents: number | null }>;
  wanted: Array<{ slug: string; name: string; filled: boolean }>;
};

export async function getEventDashboard(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<EventDashboard> {
  const event = await getEventWithPermission(actor, eventId, "event.view", executor);
  const { access } = event;
  const today = toLocalDateString(new Date(), event.timezone);
  const base = `/app/evenements/${eventId}`;

  const providerRows = await executor
    .select({ id: eventProfessionals.id, status: eventProfessionals.status, professionalId: eventProfessionals.professionalId, externalName: eventProfessionals.externalName, quoteCents: eventProfessionals.quoteCents, categoryName: professionalCategories.name })
    .from(eventProfessionals)
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventProfessionals.categoryId))
    .where(eq(eventProfessionals.eventId, eventId));
  const real = providerRows.filter((p) => p.professionalId || p.externalName);
  const providers = {
    confirmed: real.filter((p) => p.status === "confirmed").length,
    pending: real.filter((p) => p.status === "requested" || p.status === "quoted" || p.status === "shortlisted").length,
    total: real.length,
  };

  const taskWhere = access.isOrganizer ? eq(eventTasks.eventId, eventId) : and(eq(eventTasks.eventId, eventId), eq(eventTasks.visibility, "team"));
  const taskRows = await executor.select({ id: eventTasks.id, title: eventTasks.title, dueDate: eventTasks.dueDate, section: eventTasks.section, status: eventTasks.status }).from(eventTasks).where(taskWhere);
  const tasks = {
    open: taskRows.filter(isTaskOpen).length,
    overdue: taskRows.filter((t) => isTaskOverdue(t, today)).length,
    done: taskRows.filter((t) => t.status === "done").length,
    total: taskRows.length,
  };
  const upcomingTasks = taskRows
    .filter((t) => isTaskOpen(t) && t.dueDate)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 6);

  let budget: BudgetSummary | null = null;
  if (access.permissions.has("event.budget.view")) {
    const lines = await executor.select().from(eventBudgetLines).where(eq(eventBudgetLines.eventId, eventId));
    const expenses = await executor.select().from(eventExpenses).where(eq(eventExpenses.eventId, eventId));
    budget = computeBudgetSummary(lines, expenses);
  }

  let invitationStats: EventDashboard["invitations"] = null;
  if (access.permissions.has("event.invitations.manage")) {
    const [r] = await executor
      .select({
        sent: sql<number>`count(*) filter (where ${invitations.status} in ('sent','viewed','answered'))::int`,
        answered: sql<number>`count(*) filter (where ${invitations.status} = 'answered')::int`,
      })
      .from(invitations)
      .where(and(eq(invitations.eventId, eventId), inArray(invitations.kind, ["individual", "family", "group"])));
    invitationStats = { sent: r?.sent ?? 0, answered: r?.answered ?? 0 };
  }

  let childrenCount: number | null = null;
  if (access.permissions.has("children.view_roster")) {
    const [r] = await executor.select({ n: sql<number>`count(*)::int` }).from(eventChildren).where(and(eq(eventChildren.eventId, eventId), isNull(eventChildren.anonymizedAt)));
    childrenCount = r?.n ?? 0;
  }

  // Unread: messages newer than lastReadAt in channels I can see, not mine.
  const visibleChannels = await executor
    .select({ id: eventChannels.id, name: eventChannels.name, lastReadAt: channelMembers.lastReadAt })
    .from(eventChannels)
    .leftJoin(channelMembers, and(eq(channelMembers.channelId, eventChannels.id), eq(channelMembers.memberId, access.memberId)))
    .where(and(eq(eventChannels.eventId, eventId), isNull(eventChannels.archivedAt), access.permissions.has("event.channels.view_all") ? undefined : or(eq(eventChannels.isOpenToAllMembers, true), sql`${channelMembers.memberId} is not null`)));
  let unreadMessages = 0;
  for (const c of visibleChannels) {
    const [r] = await executor
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.channelId, c.id), isNull(messages.deletedAt), sql`${messages.authorUserId} <> ${actor.userId}`, c.lastReadAt ? gt(messages.createdAt, c.lastReadAt) : undefined));
    unreadMessages += r?.n ?? 0;
  }

  const channelIds = visibleChannels.map((c) => c.id);
  const recentMessages = channelIds.length
    ? await executor
        .select({ id: messages.id, body: messages.body, authorName: users.name, channelName: eventChannels.name, channelId: messages.channelId, createdAt: messages.createdAt })
        .from(messages)
        .innerJoin(users, eq(users.id, messages.authorUserId))
        .innerJoin(eventChannels, eq(eventChannels.id, messages.channelId))
        .where(and(inArray(messages.channelId, channelIds), isNull(messages.deletedAt)))
        .orderBy(desc(messages.createdAt))
        .limit(5)
    : [];

  const wanted = access.permissions.has("event.providers.view") ? await wantedCategories(eventId, executor) : [];
  const days = event.eventDate ? daysUntil(event.eventDate, today) : null;
  const alerts = access.isOrganizer
    ? computeAlerts(
        {
          daysUntil: days,
          overdueTasks: tasks.overdue,
          providersPendingConfirmation: real.filter((p) => p.status === "requested" || p.status === "quoted").length,
          budgetPlannedCents: budget?.plannedCents ?? 0,
          budgetCommittedCents: budget?.committedCents ?? 0,
          categoriesWithoutProvider: wanted.filter((w) => !w.filled).map((w) => w.name),
          overrunLines: budget?.lines.filter((l) => l.isOverrun).map((l) => l.label) ?? [],
        },
        base,
      )
    : [];

  const pendingValidations = access.permissions.has("event.providers.manage")
    ? real
        .filter((p) => p.status === "requested" || p.status === "quoted")
        .map((p) => ({ id: p.id, label: p.externalName ?? "Professionnel de la plateforme", status: p.status, categoryName: p.categoryName, quoteCents: p.quoteCents }))
    : [];


  return { event, daysUntil: days, providers, tasks, budget, invitations: invitationStats, childrenCount, unreadMessages, alerts, upcomingTasks, recentMessages, pendingValidations, wanted };
}
