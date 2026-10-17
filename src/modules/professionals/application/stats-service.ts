import { and, eq, gt, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { inquiries, inquiryEvents, publicProfiles } from "@/db/schema";
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
