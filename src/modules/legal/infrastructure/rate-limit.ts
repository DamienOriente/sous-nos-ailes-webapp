import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

/**
 * Fixed-window rate limit backed by Redis for public, unauthenticated forms.
 * Fails closed when Redis is unreachable: a public form that cannot be
 * protected is refused rather than left open.
 */
export async function consumeRateLimit(bucket: string, key: string, max: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
  const redisKey = `rl:${bucket}:${key}`;
  try {
    if (redis.status === "wait") await redis.connect();
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    return { allowed: count <= max, remaining: Math.max(0, max - count) };
  } catch (err) {
    logger.warn({ bucket, err: err instanceof Error ? err.message : String(err) }, "rate limit backend unavailable, refusing request");
    return { allowed: false, remaining: 0 };
  }
}

/** Hashes are not needed: the key only lives for the window and never leaves Redis. */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return ip;
}
