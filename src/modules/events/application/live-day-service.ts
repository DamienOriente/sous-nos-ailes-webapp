import { and, asc, eq } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventMembers, eventMilestones, events, professionalCategories } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission, type EventAccess } from "@/modules/authorization";
import { computeLiveSchedule, sequentialLinks, shiftedSteps, wouldCreateCycle, type LiveStep, type LiveTiming } from "@/modules/events/domain/live-day";
import { notify } from "@/modules/notifications/application/notification-service";
import { recordAudit } from "./audit";

/**
 * Live day-of timeline shared by organisers and providers (2026-10-19). Organisers act on every
 * step; a provider acts on the steps of their trade (or steps with no trade). Any change that
 * moves a step notifies the people concerned by the moved steps.
 */
export type LiveDayStep = LiveStep & { timing: LiveTiming; canAct: boolean; dependsOnTitle: string | null; delayReason: string | null };

function canActOn(access: EventAccess, step: { categorySlugs: string[] }): boolean {
  if (access.permissions.has("event.milestones.manage")) return true;
  if (!access.permissions.has("event.milestones.view") || !["provider", "staff"].includes(access.role)) return false;
  return step.categorySlugs.length === 0 || (access.categorySlug !== null && step.categorySlugs.includes(access.categorySlug));
}

async function loadSteps(eventId: string, executor: DbExecutor): Promise<(LiveStep & { delayReason: string | null })[]> {
  const rows = await executor.select().from(eventMilestones).where(eq(eventMilestones.eventId, eventId)).orderBy(asc(eventMilestones.startsAt), asc(eventMilestones.sortOrder));
  return rows.map((r) => ({ id: r.id, title: r.title, startsAt: r.startsAt, endsAt: r.endsAt, dependsOnMilestoneId: r.dependsOnMilestoneId, delayMinutes: r.delayMinutes, liveStatus: r.liveStatus, startedAt: r.startedAt, completedAt: r.completedAt, categorySlugs: r.categorySlugs, delayReason: r.delayReason }));
}

export async function getLiveDay(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const access = await requireEventPermission(actor, eventId, "event.milestones.view", executor);
  const [event] = await executor.select({ timezone: events.timezone, eventDate: events.eventDate, name: events.name }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new NotFoundError();
  const steps = await loadSteps(eventId, executor);
  const schedule = computeLiveSchedule(steps);
  const titles = new Map(steps.map((s) => [s.id, s.title]));
  return {
    event,
    canManage: access.permissions.has("event.milestones.manage"),
    steps: steps.map<LiveDayStep>((s) => ({ ...s, timing: schedule.get(s.id)!, canAct: canActOn(access, s), dependsOnTitle: s.dependsOnMilestoneId ? (titles.get(s.dependsOnMilestoneId) ?? null) : null })),
  };
}

function hhmm(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone }).format(d);
}

/** Organisers + providers/staff of the trades of the moved steps (never the actor). */
async function notifyShift(actor: Actor, eventId: string, timezone: string, moved: LiveDayStep[] | (LiveStep & { timing: LiveTiming })[], cause: string, executor: DbExecutor) {
  if (!moved.length) return;
  const members = await executor
    .select({ userId: eventMembers.userId, role: eventMembers.role, categorySlug: professionalCategories.slug })
    .from(eventMembers)
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventMembers.categoryId))
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, "active")));
  const organizerRoles = new Set(["owner", "lead_organizer", "co_organizer", "wedding_planner"]);
  for (const m of members) {
    if (m.userId === actor.userId) continue;
    const mine = moved.filter((s) => organizerRoles.has(m.role) || s.categorySlugs.length === 0 || (m.categorySlug !== null && s.categorySlugs.includes(m.categorySlug)));
    if (!mine.length || !(organizerRoles.has(m.role) || ["provider", "staff"].includes(m.role))) continue;
    const lines = mine.map((s) => `« ${s.title} » prévu à ${hhmm(s.timing.expectedStart, timezone)} au lieu de ${hhmm(s.startsAt, timezone)}`).join(" ; ");
    await notify(
      { userId: m.userId, type: "schedule_changed", title: `Jour J : ${cause}`, body: lines, href: `/app/evenements/${eventId}/jour-j`, eventId, dedupeKey: `live:${eventId}:${m.userId}:${mine.map((s) => `${s.id}@${s.timing.expectedStart.getTime()}`).join(",")}` },
      executor,
    );
  }
}

async function mutate(actor: Actor, eventId: string, milestoneId: string, change: (step: LiveStep, access: EventAccess, tx: DbExecutor) => Promise<string>): Promise<void> {
  await db.transaction(async (tx) => {
    const access = await requireEventPermission(actor, eventId, "event.milestones.view", tx);
    const [event] = await tx.select({ timezone: events.timezone }).from(events).where(eq(events.id, eventId)).limit(1);
    const before = await loadSteps(eventId, tx);
    const step = before.find((s) => s.id === milestoneId);
    if (!step || !event) throw new NotFoundError();
    if (!canActOn(access, step)) throw new ForbiddenError("Cette étape ne concerne pas votre métier.");
    const cause = await change(step, access, tx);
    const after = await loadSteps(eventId, tx);
    const s0 = computeLiveSchedule(before);
    const s1 = computeLiveSchedule(after);
    const movedIds = new Set(shiftedSteps(s0, s1));
    const moved = after.filter((s) => movedIds.has(s.id)).map((s) => ({ ...s, timing: s1.get(s.id)! }));
    await notifyShift(actor, eventId, event.timezone, moved, cause, tx);
    await recordAudit({ actorUserId: actor.userId, action: "milestone.live_update", resourceType: "milestone", resourceId: milestoneId, eventId, metadata: { cause, moved: [...movedIds] } }, tx);
  });
}

/** A step runs late: everything that depends on it shifts and the people concerned are told. */
export async function reportDelay(actor: Actor, eventId: string, milestoneId: string, minutes: number, reason?: string): Promise<void> {
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) throw new ValidationError("Retard entre 5 minutes et 4 heures.");
  await mutate(actor, eventId, milestoneId, async (step, _a, tx) => {
    if (step.liveStatus === "done") throw new ConflictError("Cette étape est terminée.");
    await tx.update(eventMilestones).set({ delayMinutes: step.delayMinutes + minutes, delayReason: reason?.trim().slice(0, 200) || null }).where(eq(eventMilestones.id, step.id));
    return `retard de ${minutes} min sur « ${step.title} »`;
  });
}

/** Marks a step as started or finished, with the real time (a late finish shifts what follows). */
export async function setLiveStatus(actor: Actor, eventId: string, milestoneId: string, status: "in_progress" | "done"): Promise<void> {
  await mutate(actor, eventId, milestoneId, async (step, _a, tx) => {
    const now = new Date();
    if (status === "in_progress") {
      if (step.liveStatus !== "planned") throw new ConflictError("Cette étape a déjà commencé.");
      await tx.update(eventMilestones).set({ liveStatus: "in_progress", startedAt: now }).where(eq(eventMilestones.id, step.id));
      return `« ${step.title} » commence`;
    }
    if (step.liveStatus === "done") throw new ConflictError("Cette étape est déjà terminée.");
    await tx.update(eventMilestones).set({ liveStatus: "done", startedAt: step.startedAt ?? now, completedAt: now }).where(eq(eventMilestones.id, step.id));
    return `« ${step.title} » terminé`;
  });
}

/** Organisers chain steps: `milestoneId` cannot start before `dependsOnId` ends. */
export async function setDependency(actor: Actor, eventId: string, milestoneId: string, dependsOnId: string | null, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.milestones.manage", executor);
  const steps = await loadSteps(eventId, executor);
  if (!steps.some((s) => s.id === milestoneId) || (dependsOnId && !steps.some((s) => s.id === dependsOnId))) throw new NotFoundError();
  if (dependsOnId && wouldCreateCycle(steps, milestoneId, dependsOnId)) throw new ValidationError("Ce lien créerait une boucle entre les étapes.");
  await executor.update(eventMilestones).set({ dependsOnMilestoneId: dependsOnId }).where(and(eq(eventMilestones.id, milestoneId), eq(eventMilestones.eventId, eventId)));
}

/** Chains sequential steps (parallel ones stay independent): one click to prepare the live day. */
export async function chainStepsInOrder(actor: Actor, eventId: string): Promise<{ linked: number }> {
  return db.transaction(async (tx) => {
    await requireEventPermission(actor, eventId, "event.milestones.manage", tx);
    const steps = await loadSteps(eventId, tx);
    let linked = 0;
    for (const [id, dependsOn] of sequentialLinks(steps)) {
      if (steps.find((s) => s.id === id)?.dependsOnMilestoneId) continue;
      await tx.update(eventMilestones).set({ dependsOnMilestoneId: dependsOn }).where(eq(eventMilestones.id, id));
      linked += 1;
    }
    return { linked };
  });
}

