// In-memory sliding-window rate limiter. Adequate for the single-process
// monolith this app runs as; a shared store (PostgreSQL/Redis) would be needed
// for multi-instance deployments (see docs/architecture.md).

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

type RateLimitOptions = { key: string; limit: number; windowMs: number };

function evaluate(options: RateLimitOptions, consume: boolean): RateLimitResult {
  const now = Date.now();
  sweep(now, options.windowMs);
  const bucket = buckets.get(options.key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < options.windowMs);
  if (bucket.timestamps.length >= options.limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((options.windowMs - (now - oldest)) / 1000));
    buckets.set(options.key, bucket);
    return { ok: false, retryAfterSeconds };
  }
  if (consume) bucket.timestamps.push(now);
  buckets.set(options.key, bucket);
  return { ok: true };
}

/** Checks and consumes one unit of the window. */
export function rateLimit(options: RateLimitOptions): RateLimitResult {
  return evaluate(options, true);
}

/** Checks without consuming: used to count only failed attempts (logins). */
export function peekRateLimit(options: RateLimitOptions): RateLimitResult {
  return evaluate(options, false);
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
