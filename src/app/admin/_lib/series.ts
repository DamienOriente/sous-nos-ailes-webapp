import { count, gte, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { events, inquiries, moderationCases, users } from "@/db/schema";

/**
 * Daily series (30 days, zero-filled) behind the dashboard sparklines. Read
 * model of the admin presentation layer, counted from created_at columns only.
 */
export type DailySeries = Array<{ day: string; count: number }>;

export type DashboardSeries = { signups: DailySeries; eventsCreated: DailySeries; inquiries: DailySeries; moderationCases: DailySeries };

const DAYS = 30;

async function perDay(from: PgTable, createdAt: PgColumn, since: Date): Promise<DailySeries> {
  const rows = await db
    .select({ day: sql<string>`to_char(date_trunc('day', ${createdAt}), 'YYYY-MM-DD')`, n: count() })
    .from(from)
    .where(gte(createdAt, since))
    .groupBy(sql`date_trunc('day', ${createdAt})`);
  const byDay = new Map(rows.map((r) => [r.day, r.n]));
  const out: DailySeries = [];
  for (let i = DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day: d, count: byDay.get(d) ?? 0 });
  }
  return out;
}

export async function getDashboardSeries(): Promise<DashboardSeries> {
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const [signups, eventsCreated, inquiriesSeries, cases] = await Promise.all([perDay(users, users.createdAt, since), perDay(events, events.createdAt, since), perDay(inquiries, inquiries.createdAt, since), perDay(moderationCases, moderationCases.createdAt, since)]);
  return { signups, eventsCreated, inquiries: inquiriesSeries, moderationCases: cases };
}
