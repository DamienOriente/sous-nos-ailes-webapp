import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Queue catalogue shared by producers (Next.js request path) and consumers
 * (pnpm worker). BullMQ requires its own ioredis connection with
 * maxRetriesPerRequest: null — never reuse @/lib/redis here.
 */
export const QUEUE_NAMES = ["files-scan", "email-outbox", "calendar-sync", "reminders", "retention", "generic"] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

export type QueueJobData = {
  "files-scan": { fileId: string };
  "email-outbox": { batch?: number };
  "calendar-sync": { connectionId: string };
  reminders: Record<string, never>;
  retention: Record<string, never>;
  generic: { task: string; payload?: Record<string, unknown> };
};

const globalForQueues = globalThis as unknown as { __snaBullConnection?: IORedis; __snaQueues?: Map<QueueName, Queue> };

export function createBullConnection(): IORedis {
  const conn = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
  });
  conn.on("error", (err) => logger.warn({ err: err.message }, "bullmq redis error"));
  return conn;
}

/** Producer-side connection (shared, created on first use). */
export function getBullConnection(): IORedis {
  if (!globalForQueues.__snaBullConnection) globalForQueues.__snaBullConnection = createBullConnection();
  return globalForQueues.__snaBullConnection;
}

export function getQueue<N extends QueueName>(name: N): Queue<QueueJobData[N], unknown, string> {
  if (!globalForQueues.__snaQueues) globalForQueues.__snaQueues = new Map();
  let q = globalForQueues.__snaQueues.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: getBullConnection(),
      defaultJobOptions: { removeOnComplete: { age: 24 * 3600, count: 1000 }, removeOnFail: { age: 7 * 24 * 3600 } },
    });
    globalForQueues.__snaQueues.set(name, q);
  }
  return q as Queue<QueueJobData[N], unknown, string>;
}

export type EnqueueOptions = Pick<JobsOptions, "jobId" | "delay" | "attempts" | "backoff" | "priority">;

/**
 * Adds a job. Pass `jobId` for idempotence (BullMQ ignores a duplicate active/
 * waiting id; the id must not contain ":"). Throws when Redis is unreachable:
 * callers decide whether to fall back to inline processing.
 */
export async function enqueue<N extends QueueName>(queueName: N, jobName: string, data: QueueJobData[N], opts: EnqueueOptions = {}): Promise<string> {
  // Loosen the generic: BullMQ's conditional NameType cannot be resolved for a generic N.
  const queue = getQueue(queueName) as unknown as Queue<Record<string, unknown>, unknown, string>;
  const job = await withTimeout(queue.add(jobName, data as Record<string, unknown>, { attempts: 3, backoff: { type: "exponential", delay: 5_000 }, ...opts }), 5_000, "enqueue timeout");
  return job.id ?? "";
}

export async function closeQueues(): Promise<void> {
  const queues = globalForQueues.__snaQueues;
  if (queues) {
    await Promise.all([...queues.values()].map((q) => q.close().catch(() => undefined)));
    queues.clear();
  }
  const conn = globalForQueues.__snaBullConnection;
  if (conn) {
    await conn.quit().catch(() => undefined);
    globalForQueues.__snaBullConnection = undefined;
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
