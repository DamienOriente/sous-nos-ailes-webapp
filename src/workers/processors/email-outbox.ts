import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { drainEmailOutbox } from "@/modules/notifications/application/email-outbox";
import type { QueueJobData } from "../queues";

export const EMAIL_OUTBOX_EVERY_MS = 30_000;

export async function processEmailOutboxJob(job: Job<QueueJobData["email-outbox"]>): Promise<{ sent: number; failed: number }> {
  const res = await drainEmailOutbox(job.data?.batch ?? 20);
  if (res.sent || res.failed) logger.info({ ...res }, "email outbox drained");
  return res;
}
