import Redis from "ioredis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const globalForRedis = globalThis as unknown as { __snaRedis?: Redis };

function create(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
  });
  client.on("error", (err) => logger.warn({ err: err.message }, "redis error"));
  return client;
}

export const redis: Redis = globalForRedis.__snaRedis ?? create();
if (env.APP_ENV !== "production") globalForRedis.__snaRedis = redis;

/** BullMQ needs its own connection options (it creates several clients). */
export const bullConnection = { url: env.REDIS_URL };
