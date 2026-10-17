import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { redis } from "@/lib/redis";
import { getWorkerHeartbeat } from "@/workers/health";

export const dynamic = "force-dynamic";

/** Liveness + readiness. Returns 503 when a critical dependency is down. Worker state is informative only. */
export async function GET() {
  const checks: Record<string, "ok" | "down"> = { database: "down", redis: "down", worker: "down" };
  try {
    await db.execute(sql`select 1`);
    checks.database = "ok";
  } catch {
    checks.database = "down";
  }
  try {
    if (redis.status === "wait") await redis.connect();
    if ((await redis.ping()) === "PONG") checks.redis = "ok";
  } catch {
    checks.redis = "down";
  }
  let worker: { alive: boolean; at?: string | null; ageSeconds?: number | null } = { alive: false };
  try {
    const hb = await getWorkerHeartbeat();
    worker = { alive: hb.alive, at: hb.at ?? null, ageSeconds: hb.ageSeconds ?? null };
    checks.worker = hb.alive ? "ok" : "down";
  } catch {
    checks.worker = "down";
  }
  const ready = checks.database === "ok";
  return NextResponse.json({ status: ready ? "ok" : "degraded", checks, worker, time: new Date().toISOString() }, { status: ready ? 200 : 503 });
}
