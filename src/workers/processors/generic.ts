import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import type { QueueJobData } from "../queues";

/**
 * Generic queue for other modules: `enqueue("generic", "<task>", { task, payload })`.
 * Register handlers here (pure dispatch table; the logic lives in the module).
 */
const handlers: Record<string, (payload: Record<string, unknown>) => Promise<unknown>> = {
  noop: async () => undefined,
};

export function registerGenericTask(task: string, handler: (payload: Record<string, unknown>) => Promise<unknown>): void {
  handlers[task] = handler;
}

export async function processGenericJob(job: Job<QueueJobData["generic"]>): Promise<unknown> {
  const handler = handlers[job.data.task];
  if (!handler) {
    logger.warn({ task: job.data.task, jobId: job.id }, "unknown generic task");
    return { ignored: true };
  }
  return handler(job.data.payload ?? {});
}
