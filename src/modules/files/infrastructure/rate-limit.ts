import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

/**
 * Fixed-window counter in Redis. When Redis is unreachable the limit is NOT
 * enforced (fail-open) but a warning is logged: availability of uploads is
 * preferred over a hard failure, abuse is still bounded by quotas.
 */
export async function ensureRedis(timeoutMs = 1_500): Promise<boolean> {
  try {
    if (redis.status === "wait") await redis.connect();
    const pong = await Promise.race([redis.ping(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("redis ping timeout")), timeoutMs))]);
    return pong === "PONG";
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "redis unavailable");
    return false;
  }
}

export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
  if (!(await ensureRedis())) return { allowed: true, remaining: limit };
  try {
    const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
    const redisKey = `rl:${key}:${bucket}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds + 1);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch (err) {
    logger.warn({ err: (err as Error).message, key }, "rate limit check failed (fail-open)");
    return { allowed: true, remaining: limit };
  }
}

export const UPLOAD_RATE_LIMIT = { limit: 30, windowSeconds: 600 } as const;
export const DOWNLOAD_RATE_LIMIT = { limit: 120, windowSeconds: 600 } as const;
