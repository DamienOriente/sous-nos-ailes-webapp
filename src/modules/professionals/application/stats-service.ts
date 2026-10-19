import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventMembers, events, inquiries, inquiryEvents, professionalReviews, professionalVerifications, professionals, publicProfiles } from "@/db/schema";
import type { Actor } from "@/lib/session";
import { requireProfessionalManage } from "@/modules/authorization";

export type ListingStats = {
  pageViews: number;
  inquiriesByStatus: Record<string, number>;
  inquiriesTotal: number;
  /** Share of inquiries that received at least one professional action (viewed → anything beyond). */
  responseRate: number | null;
  last30DaysInquiries: number;
};

export async function getListingStats(actor: Actor, professionalId: string, executor: DbExecutor = db): Promise<ListingStats> {
  await requireProfessionalManage(actor, professionalId, executor);
  const [profile] = await executor.select({ viewCount: publicProfiles.viewCount }).from(publicProfiles).where(eq(publicProfiles.professionalId, professionalId)).limit(1);
  const byStatus = await executor
    .select({ status: inquiries.status, n: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(eq(inquiries.professionalId, professionalId))
    .groupBy(inquiries.status);
  const inquiriesByStatus: Record<string, number> = {};
  let total = 0;
  for (const r of byStatus) {
    inquiriesByStatus[r.status] = r.n;
    total += r.n;
  }
  const [answered] = await executor
    .select({ n: sql<number>`count(distinct ${inquiryEvents.inquiryId})::int` })
    .from(inquiryEvents)
    .innerJoin(inquiries, eq(inquiries.id, inquiryEvents.inquiryId))
    .where(and(eq(inquiries.professionalId, professionalId), sql`${inquiryEvents.toStatus} is not null and ${inquiryEvents.toStatus} <> 'viewed' and ${inquiryEvents.toStatus} <> 'new'`));
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [recent] = await executor.select({ n: sql<number>`count(*)::int` }).from(inquiries).where(and(eq(inquiries.professionalId, professionalId), gt(inquiries.createdAt, since)));
  return {
    pageViews: profile?.viewCount ?? 0,
    inquiriesByStatus,
    inquiriesTotal: total,
    responseRate: total > 0 ? Math.round(((answered?.n ?? 0) / total) * 100) : null,
    last30DaysInquiries: recent?.n ?? 0,
  };
}

// ── Weekly series (workspace charts) ────────────────────────────────────────
export type WeeklyPoint = { weekStart: string; inquiries: number; confirmed: number };

export type ListingTimeline = {
  /** Oldest first, `weeks` entries ending with the current week. */
  weeks: WeeklyPoint[];
  /** Median hours between an inquiry and the first professional action, null when nothing was answered yet. */
  medianResponseHours: number | null;
  /** Page views are a single counter (no history), surfaced here so the page can say so honestly. */
  pageViews: number;
};

/**
 * Inquiries received and confirmed per ISO week, computed from `inquiries`
 * (real rows, demo ones included: the UI labels demo listings). Weeks without
 * activity are kept at zero so the chart has a continuous axis.
 */
export async function getListingTimeline(actor: Actor, professionalId: string, weeks = 12, executor: DbExecutor = db): Promise<ListingTimeline> {
  await requireProfessionalManage(actor, professionalId, executor);
  const rows = await executor
    .select({
      week: sql<string>`to_char(date_trunc('week', ${inquiries.createdAt}), 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
      confirmed: sql<number>`count(*) filter (where ${inquiries.status} in ('confirmed', 'accepted'))::int`,
    })
    .from(inquiries)
    .where(and(eq(inquiries.professionalId, professionalId), gt(inquiries.createdAt, new Date(Date.now() - weeks * 7 * 24 * 3600 * 1000))))
    .groupBy(sql`date_trunc('week', ${inquiries.createdAt})`);
  const byWeek = new Map(rows.map((r) => [r.week, r]));
  const series: WeeklyPoint[] = [];
  const now = new Date();
  // Monday of the current week, in UTC like date_trunc('week') on the server.
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = new Date(monday.getTime() - i * 7 * 24 * 3600 * 1000);
    const key = d.toISOString().slice(0, 10);
    const r = byWeek.get(key);
    series.push({ weekStart: key, inquiries: r?.n ?? 0, confirmed: r?.confirmed ?? 0 });
  }
  const [profile] = await executor.select({ viewCount: publicProfiles.viewCount }).from(publicProfiles).where(eq(publicProfiles.professionalId, professionalId)).limit(1);
  return { weeks: series, medianResponseHours: await medianResponseHours(professionalId, executor), pageViews: profile?.viewCount ?? 0 };
}

async function medianResponseHours(professionalId: string, executor: DbExecutor): Promise<number | null> {
  const [row] = await executor
    .select({
      median: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (first_action.at - ${inquiries.createdAt})) / 3600.0)::float`,
    })
    .from(inquiries)
    .innerJoin(
      sql`(select ${inquiryEvents.inquiryId} as inquiry_id, min(${inquiryEvents.createdAt}) as at from ${inquiryEvents} where ${inquiryEvents.toStatus} is not null and ${inquiryEvents.toStatus} not in ('new') group by ${inquiryEvents.inquiryId}) as first_action`,
      sql`first_action.inquiry_id = ${inquiries.id}`,
    )
    .where(eq(inquiries.professionalId, professionalId));
  const m = row?.median;
  return typeof m === "number" && Number.isFinite(m) ? Math.max(0, Math.round(m * 10) / 10) : null;
}

// ── Public activity summary ─────────────────────────────────────────────────
export type PublicActivity = {
  /** Verified checks, in display order, with the platform statement. */
  verifications: Array<{ kind: string; statement: string | null; reviewedAt: string | null }>;
  /** Median hours before the first professional action on an inquiry; null when nothing was answered yet. */
  medianResponseHours: number | null;
  /** Share of inquiries that received a professional action. */
  responseRate: number | null;
  inquiriesAnswered: number;
  /** Events where the listing is (or was) an active provider through the platform. */
  eventsCount: number;
  upcomingEventsCount: number;
  publishedReviews: number;
  averageRating: number | null;
  memberSince: string | null;
};

/**
 * Aggregates shown on the public page ("ce professionnel sur Sous Nos Ailes").
 * Everything is derived from platform records: no self-declared numbers, no
 * estimates. Safe for anonymous callers: nothing identifies an organiser.
 */
export async function getPublicActivity(professionalId: string, executor: DbExecutor = db): Promise<PublicActivity> {
  const [pro] = await executor.select({ publishedAt: professionals.publishedAt, createdAt: professionals.createdAt, averageRating: professionals.averageRating }).from(professionals).where(eq(professionals.id, professionalId)).limit(1);
  const [verifications, totals, answered, evts, reviews, median] = await Promise.all([
    executor
      .select({ kind: professionalVerifications.kind, statement: professionalVerifications.statement, reviewedAt: professionalVerifications.reviewedAt })
      .from(professionalVerifications)
      .where(and(eq(professionalVerifications.professionalId, professionalId), eq(professionalVerifications.status, "verified"))),
    executor.select({ n: sql<number>`count(*)::int` }).from(inquiries).where(eq(inquiries.professionalId, professionalId)),
    executor
      .select({ n: sql<number>`count(distinct ${inquiryEvents.inquiryId})::int` })
      .from(inquiryEvents)
      .innerJoin(inquiries, eq(inquiries.id, inquiryEvents.inquiryId))
      .where(and(eq(inquiries.professionalId, professionalId), sql`${inquiryEvents.toStatus} is not null and ${inquiryEvents.toStatus} <> 'viewed' and ${inquiryEvents.toStatus} <> 'new'`)),
    executor
      .select({ n: sql<number>`count(distinct ${eventMembers.eventId})::int`, upcoming: sql<number>`count(distinct ${eventMembers.eventId}) filter (where ${events.eventDate} >= current_date)::int` })
      .from(eventMembers)
      .innerJoin(events, eq(events.id, eventMembers.eventId))
      .where(and(eq(eventMembers.professionalId, professionalId), eq(eventMembers.status, "active"), isNull(events.deletedAt))),
    executor.select({ n: sql<number>`count(*)::int` }).from(professionalReviews).where(and(eq(professionalReviews.professionalId, professionalId), eq(professionalReviews.status, "published"))),
    medianResponseHours(professionalId, executor),
  ]);
  const total = totals[0]?.n ?? 0;
  const answeredCount = answered[0]?.n ?? 0;
  return {
    verifications: verifications.map((v) => ({ kind: v.kind, statement: v.statement, reviewedAt: v.reviewedAt?.toISOString() ?? null })),
    medianResponseHours: median,
    responseRate: total > 0 ? Math.round((answeredCount / total) * 100) : null,
    inquiriesAnswered: answeredCount,
    eventsCount: evts[0]?.n ?? 0,
    upcomingEventsCount: evts[0]?.upcoming ?? 0,
    publishedReviews: reviews[0]?.n ?? 0,
    averageRating: pro?.averageRating ?? null,
    memberSince: (pro?.publishedAt ?? pro?.createdAt)?.toISOString() ?? null,
  };
}
