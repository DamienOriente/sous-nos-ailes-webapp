import { redis } from "@/lib/redis";
import { ensureRedis } from "@/modules/files/infrastructure/rate-limit";
import { getQueue, QUEUE_NAMES, type QueueName } from "./queues";

export const WORKER_HEARTBEAT_KEY = "worker:heartbeat";
export const WORKER_HEARTBEAT_TTL_SECONDS = 60;

export type WorkerHeartbeat = { alive: boolean; at: string | null; pid: number | null; hostname: string | null; ageSeconds: number | null };

/** Written every 20 s by the worker process. Read by /api/health and the admin dashboard. */
export async function writeWorkerHeartbeat(conn: { set: (k: string, v: string, mode: "EX", ttl: number) => Promise<unknown> }, info: { pid: number; hostname: string }): Promise<void> {
  await conn.set(WORKER_HEARTBEAT_KEY, JSON.stringify({ at: new Date().toISOString(), ...info }), "EX", WORKER_HEARTBEAT_TTL_SECONDS);
}

export async function getWorkerHeartbeat(): Promise<WorkerHeartbeat> {
  const none: WorkerHeartbeat = { alive: false, at: null, pid: null, hostname: null, ageSeconds: null };
  if (!(await ensureRedis())) return none;
  try {
    const raw = await redis.get(WORKER_HEARTBEAT_KEY);
    if (!raw) return none;
    const parsed = JSON.parse(raw) as { at: string; pid: number; hostname: string };
    const age = Math.round((Date.now() - new Date(parsed.at).getTime()) / 1000);
    return { alive: age < WORKER_HEARTBEAT_TTL_SECONDS, at: parsed.at, pid: parsed.pid, hostname: parsed.hostname, ageSeconds: age };
  } catch {
    return none;
  }
}

export type QueueStats = Record<QueueName, { waiting: number; active: number; delayed: number; failed: number; completed: number }>;

/** Per-queue counters for the admin dashboard. Returns zeros when Redis is down. */
export async function getQueueStats(): Promise<{ available: boolean; queues: QueueStats }> {
  const empty = Object.fromEntries(QUEUE_NAMES.map((n) => [n, { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 }])) as QueueStats;
  if (!(await ensureRedis())) return { available: false, queues: empty };
  try {
    const entries = await Promise.all(
      QUEUE_NAMES.map(async (name) => {
        const counts = await getQueue(name).getJobCounts("waiting", "active", "delayed", "failed", "completed");
        return [name, { waiting: counts.waiting ?? 0, active: counts.active ?? 0, delayed: counts.delayed ?? 0, failed: counts.failed ?? 0, completed: counts.completed ?? 0 }] as const;
      }),
    );
    return { available: true, queues: Object.fromEntries(entries) as QueueStats };
  } catch {
    return { available: false, queues: empty };
  }
}
