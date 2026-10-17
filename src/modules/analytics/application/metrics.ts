import { and, gte, lt, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { productEvents } from "@/db/schema";
import { PRODUCT_EVENT_LABELS, type ProductEventName } from "@/modules/analytics/domain/events";

export type MetricsRange = { from: Date; to: Date };

export type ProductMetrics = {
  range: MetricsRange;
  counts: Record<ProductEventName, number>;
  /** Premium funnel: views → subscriptions → cancellations. */
  conversion: { premiumViews: number; subscriptions: number; cancellations: number; rate: number | null };
  byDay: Array<{ day: string; total: number }>;
};

const METRIC_NAMES = Object.keys(PRODUCT_EVENT_LABELS) as ProductEventName[];

export function lastDaysRange(days: number, now = new Date()): MetricsRange {
  return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), to: now };
}

export async function getProductMetrics(range: MetricsRange, executor: DbExecutor = db): Promise<ProductMetrics> {
  const where = and(gte(productEvents.createdAt, range.from), lt(productEvents.createdAt, range.to));
  const rows = await executor
    .select({ name: productEvents.name, n: sql<number>`count(*)::int` })
    .from(productEvents)
    .where(where)
    .groupBy(productEvents.name);
  const counts = Object.fromEntries(METRIC_NAMES.map((n) => [n, 0])) as Record<ProductEventName, number>;
  for (const r of rows) if (r.name in counts) counts[r.name as ProductEventName] = r.n;

  const days = await executor
    .select({ day: sql<string>`to_char(date_trunc('day', ${productEvents.createdAt}), 'YYYY-MM-DD')`, total: sql<number>`count(*)::int` })
    .from(productEvents)
    .where(where)
    .groupBy(sql`date_trunc('day', ${productEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${productEvents.createdAt})`);

  const premiumViews = counts["premium.viewed"];
  const subscriptions = counts["subscription.started"];
  return {
    range,
    counts,
    conversion: { premiumViews, subscriptions, cancellations: counts["subscription.canceled"], rate: premiumViews > 0 ? subscriptions / premiumViews : null },
    byDay: days,
  };
}
