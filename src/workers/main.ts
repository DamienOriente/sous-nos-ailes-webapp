import os from "node:os";
import { Worker, type Processor } from "bullmq";
import { pool } from "@/db/client";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { writeWorkerHeartbeat } from "./health";
import { CALENDAR_SYNC_EVERY_MS, processCalendarSyncJob, scheduleActiveCalendarSyncs } from "./processors/calendar-sync";
import { EMAIL_OUTBOX_EVERY_MS, processEmailOutboxJob } from "./processors/email-outbox";
import { FILES_SCAN_CONCURRENCY, processFilesScanJob } from "./processors/files-scan";
import { processGenericJob, registerGenericTask } from "./processors/generic";
import { processRemindersJob, REMINDERS_EVERY_MS } from "./processors/reminders";
import { processRetentionJob, RETENTION_CRON, RETENTION_TZ } from "./processors/retention";
import { closeQueues, createBullConnection, getQueue, type QueueJobData, type QueueName } from "./queues";
import { syncAllAgencies } from "@/modules/billing/application/agency-billing";
import { expireHolds } from "@/modules/inquiries/application/hold-service";
import { remindUpcomingPayments } from "@/modules/events/application/payment-service";
import { remindReviewsAfterEvents } from "@/modules/professionals/application/review-service";

/** Agency quantities and holds (past_due grace periods end without any provider event). */
const AGENCY_BILLING_EVERY_MS = 60 * 60 * 1000;

/**
 * Background worker process (`pnpm worker`). One BullMQ Worker per queue,
 * repeatable jobs declared once through job schedulers (idempotent upserts),
 * heartbeat in Redis for /api/health, graceful shutdown on SIGTERM/SIGINT.
 */
const HEARTBEAT_EVERY_MS = 20_000;

type AnyProcessor = Processor<QueueJobData[QueueName], unknown, string>;

function makeWorker<N extends QueueName>(name: N, processor: Processor<QueueJobData[N], unknown, string>, concurrency = 1): Worker {
  const worker = new Worker(name, processor as unknown as AnyProcessor, {
    connection: createBullConnection(),
    concurrency,
    lockDuration: 120_000,
    stalledInterval: 60_000,
  });
  worker.on("failed", (job, err) => logger.error({ queue: name, jobId: job?.id, attempt: job?.attemptsMade, err: err.message }, "job failed"));
  worker.on("error", (err) => logger.error({ queue: name, err: err.message }, "worker error"));
  worker.on("ready", () => logger.info({ queue: name, concurrency }, "worker ready"));
  return worker;
}

async function declareSchedulers(): Promise<void> {
  await getQueue("email-outbox").upsertJobScheduler("email-outbox-drain", { every: EMAIL_OUTBOX_EVERY_MS }, { name: "drain", data: {} });
  await getQueue("reminders").upsertJobScheduler("reminders-dispatch", { every: REMINDERS_EVERY_MS }, { name: "dispatch", data: {} });
  await getQueue("retention").upsertJobScheduler("retention-daily", { pattern: RETENTION_CRON, tz: RETENTION_TZ }, { name: "run", data: {} });
  // 08:00 Paris: payment due dates and "how was your event?" (2026-10-19).
  await getQueue("generic").upsertJobScheduler("daily-reminders", { pattern: "0 8 * * *", tz: "Europe/Paris" }, { name: "daily-reminders", data: { task: "daily-reminders" } });
  await getQueue("generic").upsertJobScheduler("holds-expiry-tick", { every: 15 * 60 * 1000 }, { name: "holds-expiry-tick", data: { task: "holds-expiry-tick" } });
  await getQueue("generic").upsertJobScheduler("agency-billing-tick", { every: AGENCY_BILLING_EVERY_MS }, { name: "agency-billing-tick", data: { task: "agency-billing-tick" } });
  await getQueue("generic").upsertJobScheduler("calendar-sync-tick", { every: CALENDAR_SYNC_EVERY_MS }, { name: "calendar-sync-tick", data: { task: "calendar-sync-tick" } });
  logger.info("job schedulers declared");
}

async function main(): Promise<void> {
  registerGenericTask("daily-reminders", async () => ({ payments: await remindUpcomingPayments(), reviews: await remindReviewsAfterEvents() }));
  registerGenericTask("holds-expiry-tick", async () => ({ expired: await expireHolds() }));
  registerGenericTask("agency-billing-tick", async () => ({ organizations: await syncAllAgencies() }));
  registerGenericTask("calendar-sync-tick", async () => ({ scheduled: await scheduleActiveCalendarSyncs() }));
  const workers: Worker[] = [
    makeWorker("files-scan", processFilesScanJob, FILES_SCAN_CONCURRENCY),
    makeWorker("email-outbox", processEmailOutboxJob),
    makeWorker("reminders", processRemindersJob),
    makeWorker("calendar-sync", processCalendarSyncJob, 2),
    makeWorker("retention", processRetentionJob),
    makeWorker("generic", processGenericJob, 2),
  ];
  await declareSchedulers();

  if (redis.status === "wait") await redis.connect();
  const info = { pid: process.pid, hostname: os.hostname() };
  const beat = async () => writeWorkerHeartbeat(redis, info).catch((err: unknown) => logger.warn({ err: (err as Error).message }, "heartbeat failed"));
  await beat();
  const heartbeat = setInterval(beat, HEARTBEAT_EVERY_MS);
  logger.info({ pid: process.pid, queues: workers.map((w) => w.name) }, "worker started");

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "worker shutting down");
    clearInterval(heartbeat);
    await Promise.all(workers.map((w) => w.close().catch(() => undefined)));
    await closeQueues();
    await redis.del("worker:heartbeat").catch(() => undefined);
    await redis.quit().catch(() => undefined);
    await pool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "worker failed to start");
  process.exit(1);
});
