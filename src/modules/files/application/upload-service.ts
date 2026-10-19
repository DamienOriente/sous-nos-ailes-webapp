import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";
import { db, type DbExecutor } from "@/db/client";
import { files } from "@/db/schema";
import { env } from "@/lib/env";
import { sha256Hex } from "@/lib/crypto";
import { RateLimitedError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Actor } from "@/lib/session";
import { inspectOfficeArchive } from "@/modules/files/domain/office-archive";
import { looksLikePdf } from "@/modules/files/domain/pdf-heuristics";
import {
  ABSOLUTE_MAX_BYTES,
  evaluateUploadPolicy,
  isFilePurpose,
  isFileScope,
  mimeFamily,
  quarantineKey,
  SCOPE_QUOTA_BYTES,
  type FilePurpose,
  type FileScope,
  type FileStatus,
} from "@/modules/files/domain/policy";
import { authorizeScopeWrite } from "@/modules/files/application/file-access";
import { processFileNow } from "@/modules/files/application/processing";
import { ensureRedis, hitRateLimit, UPLOAD_RATE_LIMIT } from "@/modules/files/infrastructure/rate-limit";
import { BUCKETS, putObject } from "@/modules/files/infrastructure/s3";
import { recordFileSecurityEvent } from "@/modules/files/infrastructure/security-log";
import { getWorkerHeartbeat } from "@/workers/health";
import { enqueue } from "@/workers/queues";

export type UploadInput = {
  scope: string;
  scopeId: string;
  purpose: string;
  originalName: string;
  bytes: Buffer;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type UploadedFile = { id: string; originalName: string; mimeType: string; sizeBytes: number; status: FileStatus; rejectionReason: string | null; deduplicated: boolean };

export type ProcessMode = "auto" | "inline" | "none";

/**
 * Steps 1–8 of the pipeline (caller already authenticated the actor), then
 * schedules steps 9–17 (`processFileNow`) on the files-scan queue, or runs
 * them inline when no worker is reachable.
 */
export async function createUpload(actor: Actor, input: UploadInput, opts: { process?: ProcessMode } = {}): Promise<UploadedFile> {
  const { scope, purpose } = parseScopeAndPurpose(input);
  const scopeId = input.scopeId.trim();
  if (!scopeId || scopeId.length > 64) throw new ValidationError("Identifiant de périmètre invalide.");
  const originalName = sanitizeOriginalName(input.originalName);
  const ctx = { userId: actor.userId, scope, scopeId, purpose, ipAddress: input.ipAddress, userAgent: input.userAgent };

  // 2. authorisation on the scope
  await authorizeScopeWrite(actor, scope, scopeId, purpose);

  // 3. limits: rate, size, quota
  const rl = await hitRateLimit(`upload:${actor.userId}`, UPLOAD_RATE_LIMIT.limit, UPLOAD_RATE_LIMIT.windowSeconds);
  if (!rl.allowed) {
    await recordFileSecurityEvent("upload_rate_limited", ctx);
    throw new RateLimitedError("Trop d'envois en peu de temps. Réessayez dans quelques minutes.");
  }
  if (input.bytes.length === 0) throw new ValidationError("Le fichier est vide.");
  if (input.bytes.length > ABSOLUTE_MAX_BYTES) {
    await recordFileSecurityEvent("upload_rejected", { ...ctx, reason: "absolute_size" });
    throw new ValidationError("Fichier trop volumineux (maximum 20 Mo).");
  }
  const used = await scopeUsage(scope, scopeId);
  if (used + input.bytes.length > SCOPE_QUOTA_BYTES[scope]) {
    await recordFileSecurityEvent("upload_quota_exceeded", ctx);
    throw new ValidationError("Espace de stockage insuffisant pour ce périmètre.");
  }

  // 5–8. real type, extension coherence, allowlist, size
  const detected = await fileTypeFromBuffer(input.bytes);
  const decision = evaluateUploadPolicy({ scope, purpose, originalName, detectedMime: detected?.mime ?? null, sizeBytes: input.bytes.length });
  if (!decision.ok) {
    await recordFileSecurityEvent("upload_rejected", { ...ctx, reason: decision.code });
    throw new ValidationError(decision.reason);
  }
  const family = mimeFamily(decision.mime);
  if (family === "office") {
    const archive = inspectOfficeArchive(input.bytes);
    if (!archive.ok) {
      await recordFileSecurityEvent("upload_rejected", { ...ctx, reason: `office_${archive.code}` });
      throw new ValidationError(archive.reason);
    }
  }
  if (family === "pdf" && !looksLikePdf(input.bytes)) {
    await recordFileSecurityEvent("upload_rejected", { ...ctx, reason: "pdf_header" });
    throw new ValidationError("Le document PDF est invalide.");
  }

  // Deduplication inside the same scope only (never reveals other tenants' files).
  const sha256 = sha256Hex(input.bytes);
  const [dup] = await db
    .select({ id: files.id, originalName: files.originalName, mimeType: files.mimeType, sizeBytes: files.sizeBytes, status: files.status, rejectionReason: files.rejectionReason })
    .from(files)
    .where(and(eq(files.sha256, sha256), eq(files.scope, scope), eq(files.scopeId, scopeId), isNull(files.deletedAt), inArray(files.status, ["quarantined", "scanning", "clean"])))
    .limit(1);
  if (dup) {
    logger.info({ fileId: dup.id, scope, purpose }, "upload deduplicated");
    return { ...dup, deduplicated: true };
  }

  // 4. quarantine storage under an opaque key (UUID = future file id)
  const id = randomUUID();
  const qKey = quarantineKey(id);
  await putObject(BUCKETS.quarantine, qKey, input.bytes, decision.mime);

  const [row] = await db
    .insert(files)
    .values({
      id,
      uploaderUserId: actor.userId,
      scope,
      scopeId,
      purpose,
      status: "quarantined",
      bucket: BUCKETS.quarantine,
      storageKey: qKey,
      originalName,
      mimeType: decision.mime,
      extension: decision.extension,
      sizeBytes: input.bytes.length,
      sha256,
    })
    .returning({ id: files.id, originalName: files.originalName, mimeType: files.mimeType, sizeBytes: files.sizeBytes, status: files.status, rejectionReason: files.rejectionReason });
  if (!row) throw new Error("file insert returned no row");

  const mode = opts.process ?? "auto";
  if (mode === "none") return { ...row, deduplicated: false };
  const scheduled = mode === "auto" ? await tryEnqueueScan(id) : false;
  if (scheduled) return { ...row, deduplicated: false };

  const status = await processFileNow(id);
  const [fresh] = await db.select({ status: files.status, rejectionReason: files.rejectionReason, sizeBytes: files.sizeBytes, mimeType: files.mimeType }).from(files).where(eq(files.id, id)).limit(1);
  return { ...row, ...(fresh ?? {}), status: fresh?.status ?? status, deduplicated: false };
}

/** Queue the scan when Redis AND a live worker are present; otherwise the caller processes inline. */
async function tryEnqueueScan(fileId: string): Promise<boolean> {
  if (!(await ensureRedis())) {
    logger.warn({ fileId }, "redis unavailable: processing file inline");
    return false;
  }
  const hb = await getWorkerHeartbeat();
  if (!hb.alive) {
    logger.warn({ fileId }, "no live worker heartbeat: processing file inline");
    return false;
  }
  try {
    await enqueue("files-scan", "scan", { fileId }, { jobId: `scan-${fileId}` });
    return true;
  } catch (err) {
    logger.warn({ fileId, err: (err as Error).message }, "enqueue failed: processing file inline");
    return false;
  }
}

export async function scopeUsage(scope: FileScope, scopeId: string, executor: DbExecutor = db): Promise<number> {
  const [r] = await executor
    .select({ total: sql<number>`coalesce(sum(${files.sizeBytes}), 0)::bigint` })
    .from(files)
    .where(and(eq(files.scope, scope), eq(files.scopeId, scopeId), isNull(files.deletedAt), inArray(files.status, ["quarantined", "scanning", "clean"])));
  return Number(r?.total ?? 0);
}

function parseScopeAndPurpose(input: UploadInput): { scope: FileScope; purpose: FilePurpose } {
  if (!isFileScope(input.scope)) throw new ValidationError("Périmètre de fichier invalide.");
  if (!isFilePurpose(input.purpose)) throw new ValidationError("Usage de fichier invalide.");
  if (input.scope === "system" && env.APP_ENV === "production") throw new ValidationError("Périmètre réservé.");
  return { scope: input.scope, purpose: input.purpose };
}

/** Keeps the display name harmless: no path, no control chars, bounded length. Storage never uses it. */
export function sanitizeOriginalName(name: string): string {
  const base = (name ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "fichier").slice(0, 200);
}
