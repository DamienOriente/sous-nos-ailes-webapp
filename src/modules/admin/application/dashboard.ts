import { and, count, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { events, inquiries, professionals, securityEvents, users } from "@/db/schema";
import { computeMrr, type MrrSummary } from "@/modules/billing/application/billing-admin";
import { canGlobal } from "@/modules/authorization";
import { countOpenCases } from "@/modules/moderation/application/moderation-service";
import { countOpenReports } from "@/modules/moderation/application/report-service";
import { outboxStats } from "@/modules/notifications/application/email-outbox";
import { listSubscriptionsAdmin } from "@/modules/billing/application/billing-admin";
import type { Actor } from "@/lib/session";
import { grantsAccess } from "@/modules/billing/domain/subscription-status";

/**
 * Admin dashboard numbers. Everything comes from the database; demo series are
 * labelled as such by the caller (isDemo flags). Queue stats come from the
 * worker module through a tolerant import (the worker may not be running).
 */
export type DashboardData = {
  users: { total: number; demo: number; byRole: Record<string, number> };
  professionals: Record<string, number>;
  pendingModeration: number;
  activeEvents: number;
  inquiries30d: number;
  openReports: number;
  subscriptionsByPlan: Array<{ planKey: string; planName: string; count: number; demo: number }>;
  mrr: MrrSummary;
  /** False for moderators: billing cards are hidden. */
  billingVisible: boolean;
  signupsPerDay: Array<{ day: string; count: number }>;
  securityAlerts: Array<{ id: string; type: string; severity: string; createdAt: Date; details: Record<string, unknown> }>;
  queues: { available: boolean; queues: Record<string, { waiting: number; active: number; delayed: number; failed: number; completed: number }> } | null;
  worker: { alive: boolean; at: string | null } | null;
  outbox: { pending: number; failed: number; sent: number };
};

type HealthModule = {
  getQueueStats?: () => Promise<{ available: boolean; queues: Record<string, { waiting: number; active: number; delayed: number; failed: number; completed: number }> }>;
  getWorkerHeartbeat?: () => Promise<{ alive: boolean; at: string | null }>;
};

async function loadHealth(): Promise<HealthModule | null> {
  try {
    return (await import("@/workers/health")) as HealthModule;
  } catch {
    return null;
  }
}

export async function getDashboardData(actor: Actor): Promise<DashboardData> {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [userRows, proRows, pendingModeration, [activeEventsRow], [inquiryRow], openReports, mrr, subs, signups, alerts, outbox, health] = await Promise.all([
    db.select({ role: users.role, isDemo: users.isDemo, n: count() }).from(users).groupBy(users.role, users.isDemo),
    db.select({ status: professionals.status, n: count() }).from(professionals).where(isNull(professionals.deletedAt)).groupBy(professionals.status),
    countOpenCases(),
    db.select({ n: count() }).from(events).where(and(isNull(events.deletedAt), inArray(events.status, ["planning", "confirmed", "in_progress"]))),
    db.select({ n: count() }).from(inquiries).where(gte(inquiries.createdAt, since30)),
    countOpenReports(),
    computeMrr(),
    // Billing figures are reserved to roles holding admin.billing.view (moderators see the rest of the dashboard).
    canGlobal(actor, "admin.billing.view") ? listSubscriptionsAdmin(actor, { limit: 1000 }) : Promise.resolve([]),
    db
      .select({ day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`, n: count() })
      .from(users)
      .where(gte(users.createdAt, since30))
      .groupBy(sql`date_trunc('day', ${users.createdAt})`)
      .orderBy(sql`date_trunc('day', ${users.createdAt})`),
    db
      .select({ id: securityEvents.id, type: securityEvents.type, severity: securityEvents.severity, createdAt: securityEvents.createdAt, details: securityEvents.details })
      .from(securityEvents)
      .where(and(gte(securityEvents.createdAt, since30), inArray(securityEvents.severity, ["medium", "high", "critical"])))
      .orderBy(sql`${securityEvents.createdAt} desc`)
      .limit(10),
    outboxStats(),
    loadHealth(),
  ]);

  const byRole: Record<string, number> = {};
  let total = 0;
  let demo = 0;
  for (const r of userRows) {
    byRole[r.role] = (byRole[r.role] ?? 0) + r.n;
    total += r.n;
    if (r.isDemo) demo += r.n;
  }
  const byPlan = new Map<string, { planKey: string; planName: string; count: number; demo: number }>();
  for (const s of subs) {
    if (!grantsAccess(s)) continue;
    const e = byPlan.get(s.planKey) ?? { planKey: s.planKey, planName: s.planName, count: 0, demo: 0 };
    e.count += 1;
    if (s.provider === "mock" || s.userIsDemo) e.demo += 1;
    byPlan.set(s.planKey, e);
  }
  // Fill the 30-day series with zeros so the bars are comparable.
  const series: Array<{ day: string; count: number }> = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ day: d, count: signups.find((s) => s.day === d)?.n ?? 0 });
  }

  const [queues, worker] = health ? await Promise.all([health.getQueueStats?.() ?? Promise.resolve(null), health.getWorkerHeartbeat?.() ?? Promise.resolve(null)]) : [null, null];

  return {
    users: { total, demo, byRole },
    professionals: Object.fromEntries(proRows.map((r) => [r.status, r.n])),
    pendingModeration,
    activeEvents: activeEventsRow?.n ?? 0,
    inquiries30d: inquiryRow?.n ?? 0,
    openReports,
    subscriptionsByPlan: [...byPlan.values()],
    mrr,
    billingVisible: canGlobal(actor, "admin.billing.view"),
    signupsPerDay: series,
    securityAlerts: alerts,
    queues,
    worker,
    outbox,
  };
}

