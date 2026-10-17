// Shared setup for integration tests: they run serially against the local
// database (docker compose). Each test file is responsible for cleaning the
// rows it creates (prefix demo data with "itest-" to make cleanup easy).
import { afterAll } from "vitest";
import { pool } from "@/db/client";
import { redis } from "@/lib/redis";

afterAll(async () => {
  await pool.end().catch(() => undefined);
  await redis.quit().catch(() => undefined);
});
