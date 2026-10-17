import { and, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { files, retentionJobs, sessions } from "@/db/schema";
import { logger } from "@/lib/logger";
import { BUCKETS, deleteObjects, listObjects } from "@/modules/files/infrastructure/s3";
import { runRetentionPolicies } from "@/modules/privacy/application/retention";
import { revokeExpiredBreakGlass } from "@/modules/admin/application/break-glass";

/** Daily at 03:00 Europe/Paris. */
export const RETENTION_CRON = "0 3 * * *";
export const RETENTION_TZ = "Europe/Paris";

const DAY = 24 * 3600 * 1000;

export async function processRetentionJob(): Promise<Array<{ policy: string; affected: number }>> {
  const results: Array<{ policy: string; affected: number }> = [];
  results.push(...(await runRetentionPolicies()));
  // Temporary "break-glass" support access granted by super admins expires automatically.
  try {
    const revoked = await revokeExpiredBreakGlass();
    results.push({ policy: "break_glass_expiry", affected: revoked.revoked });
  } catch (err) {
    logger.error({ err }, "break-glass revocation failed");
  }
  results.push(await runPolicy("sessions_purge", purgeExpiredSessions));
  results.push(await runPolicy("files_purge", purgeRejectedFiles));
  results.push(await runPolicy("files_stuck_scanning", failStuckScans));
  results.push(await runPolicy("quarantine_orphans", purgeOrphanQuarantine));
  logger.info({ results }, "retention run complete");
  return results;
}

async function runPolicy(policy: string, fn: () => Promise<number>): Promise<{ policy: string; affected: number }> {
  const [job] = await db.insert(retentionJobs).values({ policy, status: "running", startedAt: new Date() }).returning({ id: retentionJobs.id });
  try {
    const affected = await fn();
    if (job) await db.update(retentionJobs).set({ status: "succeeded", affectedCount: affected, finishedAt: new Date() }).where(sql`${retentionJobs.id} = ${job.id}`);
    return { policy, affected };
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    if (job) await db.update(retentionJobs).set({ status: "failed", error: message, finishedAt: new Date() }).where(sql`${retentionJobs.id} = ${job.id}`);
    logger.error({ policy, err: message }, "retention policy failed");
    return { policy, affected: 0 };
  }
}

async function purgeExpiredSessions(): Promise<number> {
  const res = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning({ id: sessions.id });
  return res.length;
}

/** Rejected/infected rows older than 7 days: bytes are already gone, drop the metadata (scan results cascade). */
async function purgeRejectedFiles(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * DAY);
  const res = await db
    .delete(files)
    .where(and(inArray(files.status, ["rejected", "infected"]), lt(files.updatedAt, cutoff)))
    .returning({ id: files.id });
  return res.length;
}

/** A scan that could not complete in 24 h is given up: the user re-uploads. */
async function failStuckScans(): Promise<number> {
  const cutoff = new Date(Date.now() - DAY);
  const stuck = await db
    .select({ id: files.id, bucket: files.bucket, storageKey: files.storageKey })
    .from(files)
    .where(and(inArray(files.status, ["quarantined", "scanning"]), lt(files.createdAt, cutoff), isNull(files.deletedAt)));
  if (stuck.length === 0) return 0;
  const byBucket = new Map<string, string[]>();
  for (const f of stuck) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.storageKey]);
  for (const [bucket, keys] of byBucket) await deleteObjects(bucket, keys);
  await db
    .update(files)
    .set({ status: "rejected", rejectionReason: "Analyse antivirus impossible dans le délai imparti." })
    .where(inArray(files.id, stuck.map((f) => f.id)));
  return stuck.length;
}

/** Quarantine objects older than 1 day with no pending row behind them. */
async function purgeOrphanQuarantine(): Promise<number> {
  const objects = await listObjects(BUCKETS.quarantine, "q/");
  const cutoff = Date.now() - DAY;
  const old = objects.filter((o) => (o.lastModified?.getTime() ?? 0) < cutoff);
  if (old.length === 0) return 0;
  const pending = await db
    .select({ storageKey: files.storageKey })
    .from(files)
    .where(and(inArray(files.status, ["quarantined", "scanning"]), inArray(files.storageKey, old.map((o) => o.key))));
  const keep = new Set(pending.map((p) => p.storageKey));
  const orphans = old.filter((o) => !keep.has(o.key)).map((o) => o.key);
  await deleteObjects(BUCKETS.quarantine, orphans);
  return orphans.length;
}
