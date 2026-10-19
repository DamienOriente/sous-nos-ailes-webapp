import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import * as schema from "@/db/schema";

/**
 * One pool per process (Next.js dev hot-reload keeps it on globalThis).
 * Workers import the same module and get their own pool.
 */
const globalForDb = globalThis as unknown as { __snaPool?: Pool };

function createPool(): Pool {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    application_name: "sous-nos-ailes",
  });
  pool.on("error", (err) => logger.error({ err }, "postgres pool error"));
  return pool;
}

export const pool: Pool = globalForDb.__snaPool ?? createPool();
if (env.APP_ENV !== "production") globalForDb.__snaPool = pool;

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either the root db or a transaction handle: services accept both. */
export type DbExecutor = Db | Tx;
