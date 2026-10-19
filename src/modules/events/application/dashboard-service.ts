import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { channelMembers, eventBudgetLines, eventChannels, eventChildren, eventExpenses, eventMembers, eventMilestones, eventProfessionals, eventTasks, invitations, messages, professionalCategories, professionals, users } from "@/db/schema";
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
  /** Next moments of the planning (D-day timeline), oldest first. */
  upcomingMilestones: Array<{ id: string; title: string; startsAt: Date; endsAt: Date | null; location: string | null }>;
  /** Checklist progress by section (organisers only). */
  sectionProgress: Array<{ section: string; done: number; total: number }>;
  /** Confirmed providers with the cover of their public listing when it exists. */
  confirmedProviders: Array<{ id: string; displayName: string; categoryName: string | null; coverFileId: string | null; proSlug: string | null; isExternal: boolean }>;
  /** Childcare team (members whose trade is childcare) + headcounts; null when the actor cannot see the roster. */
  childcareTeam: { members: Array<{ id: string; name: string; role: string; title: string | null; assigned: number }>; children: number; expected: number | null } | null;
};

export async function getEventDashboard(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<EventDashboard> {
  const event = await getEventWithPermission(actor, eventId, "event.view", executor);
  const { access } = event;
  const today = toLocalDateString(new Date(), event.timezone);
  const base = `/app/evenements/${eventId}`;

  const providerRows = await executor
    .select({ id: eventProfessionals.id, status: eventProfessionals.status, professionalId: eventProfessionals.professionalId, externalName: eventProfessionals.externalName, proName: professionals.displayName, quoteCents: eventProfessionals.quoteCents, categoryName: professionalCategories.name })
    .from(eventProfessionals)
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventProfessionals.categoryId))
    .leftJoin(professionals, eq(professionals.id, eventProfessionals.professionalId))
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
        .map((p) => ({ id: p.id, label: p.proName ?? p.externalName ?? "Professionnel de la plateforme", status: p.status, categoryName: p.categoryName, quoteCents: p.quoteCents }))
    : [];

  const upcomingMilestones = access.permissions.has("event.milestones.view")
    ? await executor
        .select({ id: eventMilestones.id, title: eventMilestones.title, startsAt: eventMilestones.startsAt, endsAt: eventMilestones.endsAt, location: eventMilestones.location })
        .from(eventMilestones)
        .where(eq(eventMilestones.eventId, eventId))
        .orderBy(asc(eventMilestones.startsAt), asc(eventMilestones.sortOrder))
        .limit(6)
    : [];

  const sectionMap = new Map<string, { done: number; total: number }>();
  if (access.isOrganizer) {
    for (const t of taskRows) {
      if (t.status === "cancelled") continue;
      const key = t.section ?? "Autres";
      const acc = sectionMap.get(key) ?? { done: 0, total: 0 };
      acc.total += 1;
      if (t.status === "done") acc.done += 1;
      sectionMap.set(key, acc);
    }
  }
  const sectionProgress = [...sectionMap.entries()].map(([section, v]) => ({ section, ...v }));

  const confirmedProviders = access.permissions.has("event.providers.view")
    ? (
        await executor
          .select({
            id: eventProfessionals.id,
            externalName: eventProfessionals.externalName,
            proName: professionals.displayName,
            proSlug: professionals.slug,
            professionalId: eventProfessionals.professionalId,
            categoryName: professionalCategories.name,
            coverFileId: sql<string | null>`(select ma.file_id from media_assets ma where ma.professional_id = ${eventProfessionals.professionalId} and ma.kind = 'cover' order by ma.sort_order asc limit 1)`,
          })
          .from(eventProfessionals)
          .leftJoin(professionals, eq(professionals.id, eventProfessionals.professionalId))
          .leftJoin(professionalCategories, eq(professionalCategories.id, eventProfessionals.categoryId))
          .where(and(eq(eventProfessionals.eventId, eventId), eq(eventProfessionals.status, "confirmed")))
          .orderBy(asc(professionalCategories.sortOrder))
      )
        .filter((p) => p.proName || p.externalName)
        .map((p) => ({ id: p.id, displayName: p.proName ?? p.externalName ?? "", categoryName: p.categoryName, coverFileId: p.professionalId ? p.coverFileId : null, proSlug: p.proSlug, isExternal: !p.professionalId }))
    : [];

  let childcareTeam: EventDashboard["childcareTeam"] = null;
  if (childrenCount !== null) {
    const team = await executor
      .select({
        id: eventMembers.id,
        name: users.name,
        role: eventMembers.role,
        title: eventMembers.title,
        assigned: sql<number>`(select count(*) from child_care_assignments a join event_children c on c.id = a.child_id where a.member_id = ${eventMembers.id} and c.anonymized_at is null)::int`,
      })
      .from(eventMembers)
      .innerJoin(users, eq(users.id, eventMembers.userId))
      .innerJoin(professionalCategories, eq(professionalCategories.id, eventMembers.categoryId))
      .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, "active"), eq(professionalCategories.isChildcare, true)))
      .orderBy(asc(users.name));
    childcareTeam = { members: team, children: childrenCount, expected: event.expectedChildren };
  }

  return { event, daysUntil: days, providers, tasks, budget, invitations: invitationStats, childrenCount, unreadMessages, alerts, upcomingTasks, recentMessages, pendingValidations, wanted, upcomingMilestones, sectionProgress, confirmedProviders, childcareTeam };
}
