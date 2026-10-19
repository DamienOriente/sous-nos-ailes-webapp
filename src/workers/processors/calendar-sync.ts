import type { Job } from "bullmq";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { calendarConnections } from "@/db/schema";
import { logger } from "@/lib/logger";
import { runCalendarSyncJob } from "@/modules/calendar/application/sync-engine";
import { enqueue, type QueueJobData } from "../queues";

/** Every active connection is synchronised periodically (plus on demand from the UI). */
export const CALENDAR_SYNC_EVERY_MS = 15 * 60 * 1000;

export async function processCalendarSyncJob(job: Job<QueueJobData["calendar-sync"]>) {
  const res = await runCalendarSyncJob(job.data.connectionId);
  logger.info({ connectionId: job.data.connectionId, ...res }, "calendar sync done");
  return res;
}

/** Scheduler tick: enqueue one idempotent job per active connection (export-only ones included: they push local changes). */
export async function scheduleActiveCalendarSyncs(): Promise<number> {
  const rows = await db
    .select({ id: calendarConnections.id })
    .from(calendarConnections)
    .where(and(eq(calendarConnections.status, "active"), ne(calendarConnections.syncDirection, "none")));
  for (const row of rows) {
    // jobId must not contain ":" (BullMQ 6); the connection id is a UUID.
    await enqueue("calendar-sync", "sync", { connectionId: row.id }, { jobId: `sync-${row.id}` });
  }
  return rows.length;
}
