import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { RateLimitedError } from "@/lib/errors";

/**
 * Fixed-window counter in Redis. Fails open (logged) when Redis is down so a
 * cache outage never blocks guests from answering; the DB still bounds writes.
 */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  try {
    const k = `rl:${key}`;
    const count = await redis.incr(k);
    if (count === 1) await redis.expire(k, windowSeconds);
    if (count > limit) throw new RateLimitedError();
  } catch (err) {
    if (err instanceof RateLimitedError) throw err;
    logger.warn({ err: err instanceof Error ? err.message : String(err), key }, "rate limit unavailable, failing open");
  }
}
