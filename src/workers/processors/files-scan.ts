import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { processFileNow } from "@/modules/files/application/processing";
import type { QueueJobData } from "../queues";

export const FILES_SCAN_CONCURRENCY = 2;

export async function processFilesScanJob(job: Job<QueueJobData["files-scan"]>): Promise<{ status: string }> {
  const status = await processFileNow(job.data.fileId);
  logger.info({ jobId: job.id, fileId: job.data.fileId, status, attempt: job.attemptsMade + 1 }, "files-scan job done");
  return { status };
}
