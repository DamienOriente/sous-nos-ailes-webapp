import { and, desc, eq, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { auditLogs, fileAccessLogs, files } from "@/db/schema";
import { NotFoundError, RateLimitedError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { authorizeScopeWrite, canReadFile, isPubliclyVisible, type FileRecord } from "@/modules/files/application/file-access";
import type { ImageVariant } from "@/modules/files/application/file-urls";
import { isFileScope, SENSITIVE_PURPOSES, type FilePurpose, type FileScope, type FileStatus } from "@/modules/files/domain/policy";
import { DOWNLOAD_RATE_LIMIT, hitRateLimit } from "@/modules/files/infrastructure/rate-limit";
import { deleteObjects, presignGet } from "@/modules/files/infrastructure/s3";
import { recordFileSecurityEvent } from "@/modules/files/infrastructure/security-log";

export const PRIVATE_URL_TTL_SECONDS = 5 * 60;
export const PUBLIC_URL_TTL_SECONDS = 60 * 60;

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export type FileStatusView = {
  id: string;
  status: FileStatus;
  rejectionReason: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  variants: string[];
  createdAt: Date;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadVisibleFile(actor: Actor | null, fileId: string, meta: RequestMeta, executor: DbExecutor = db): Promise<FileRecord> {
  if (!UUID_RE.test(fileId)) throw new NotFoundError();
  const [file] = await executor.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file || !(await canReadFile(actor, file, executor))) {
    await recordFileSecurityEvent("file_access_denied", { userId: actor?.userId ?? null, fileId, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, executor);
    if (file) await executor.insert(fileAccessLogs).values({ fileId, userId: actor?.userId ?? null, action: "denied" });
    throw new NotFoundError();
  }
  return file;
}

/** Status for the upload component polling. Visible to anyone who can read the file (uploader included while scanning). */
export async function getFileStatus(actor: Actor, fileId: string, meta: RequestMeta = {}): Promise<FileStatusView> {
  const f = await loadVisibleFile(actor, fileId, meta);
  return toStatusView(f);
}

export function toStatusView(f: FileRecord): FileStatusView {
  return {
    id: f.id,
    status: f.status,
    rejectionReason: f.rejectionReason,
    originalName: f.originalName,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    width: f.width,
    height: f.height,
    variants: Object.keys(f.variants ?? {}),
    createdAt: f.createdAt,
  };
}

/**
 * Private access: authorisation → status must be clean → rate limit → signed
 * URL valid 5 minutes. Sensitive purposes are logged.
 */
export async function issueFileUrl(actor: Actor, fileId: string, opts: { download?: boolean } & RequestMeta = {}): Promise<{ url: string; fileName: string; mimeType: string }> {
  const file = await loadVisibleFile(actor, fileId, opts);
  if (file.status !== "clean") throw new NotFoundError();
  const rl = await hitRateLimit(`download:${actor.userId}`, DOWNLOAD_RATE_LIMIT.limit, DOWNLOAD_RATE_LIMIT.windowSeconds);
  if (!rl.allowed) throw new RateLimitedError("Trop de téléchargements. Réessayez dans quelques minutes.");

  const url = await presignGet(file.bucket, file.storageKey, {
    expiresInSeconds: PRIVATE_URL_TTL_SECONDS,
    download: opts.download ? { fileName: file.originalName } : null,
    contentType: file.mimeType,
  });
  if (SENSITIVE_PURPOSES.has(file.purpose as FilePurpose)) {
    await db.insert(fileAccessLogs).values({ fileId: file.id, userId: actor.userId, action: opts.download ? "download" : "view" });
  }
  await db.update(files).set({ downloadCount: file.downloadCount + 1 }).where(eq(files.id, file.id));
  return { url, fileName: file.originalName, mimeType: file.mimeType };
}

/**
 * Public rendition of a listing image (logo/cover/gallery of a published
 * professional) or, for an authenticated caller with access, any image.
 * Returns a 1 h signed URL for the requested variant.
 */
/** Resolves which stored object serves a public image variant (nothing is signed or fetched here). */
export async function resolvePublicImage(actor: Actor | null, fileId: string, variant: ImageVariant, meta: RequestMeta = {}): Promise<{ bucket: string; key: string; mimeType: string; publiclyVisible: boolean }> {
  if (!UUID_RE.test(fileId)) throw new NotFoundError();
  const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file || file.status !== "clean" || !file.mimeType.startsWith("image/")) throw new NotFoundError();
  const publicOk = await isPubliclyVisible(file);
  if (!publicOk && !(actor && (await canReadFile(actor, file)))) {
    await recordFileSecurityEvent("file_access_denied", { userId: actor?.userId ?? null, fileId, ipAddress: meta.ipAddress, userAgent: meta.userAgent });
    throw new NotFoundError();
  }
  const v = variant !== "original" ? file.variants?.[variant] : undefined;
  // Missing variant (older uploads): the next larger one, then the original.
  const order = ["thumb", "card", "medium", "large"] as const;
  const larger = variant === "original" ? [] : order.slice(order.indexOf(variant as (typeof order)[number]) + 1).map((n) => file.variants?.[n]);
  const fallback = v ?? larger.find(Boolean) ?? file.variants?.large ?? file.variants?.medium ?? file.variants?.thumb;
  const key = variant === "original" || !fallback ? file.storageKey : fallback.key;
  const mimeType = variant === "original" || !fallback ? file.mimeType : "image/webp";
  return { bucket: file.bucket, key, mimeType, publiclyVisible: publicOk };
}

export async function issuePublicImageUrl(actor: Actor | null, fileId: string, variant: ImageVariant, meta: RequestMeta = {}): Promise<{ url: string; mimeType: string }> {
  const { bucket, key, mimeType } = await resolvePublicImage(actor, fileId, variant, meta);
  const url = await presignGet(bucket, key, { expiresInSeconds: PUBLIC_URL_TTL_SECONDS, contentType: mimeType });
  return { url, mimeType };
}

/** Soft delete + removal of every stored object. Allowed to the uploader and to scope managers. */
export async function deleteFile(actor: Actor, fileId: string, meta: RequestMeta = {}): Promise<void> {
  if (!UUID_RE.test(fileId)) throw new NotFoundError();
  const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file || file.deletedAt) throw new NotFoundError();
  if (file.uploaderUserId !== actor.userId) {
    if (!isFileScope(file.scope)) throw new NotFoundError();
    await authorizeScopeWrite(actor, file.scope, file.scopeId, file.purpose as FilePurpose);
  }
  const keys = [file.storageKey, ...Object.values(file.variants ?? {}).map((v) => v.key)];
  if (file.status === "clean" || file.status === "quarantined" || file.status === "scanning") {
    await deleteObjects(file.bucket, keys);
  }
  await db.transaction(async (tx) => {
    await tx.update(files).set({ status: "deleted", deletedAt: new Date(), variants: {} }).where(eq(files.id, fileId));
    await tx.insert(auditLogs).values({
      actorUserId: actor.userId,
      action: "file.deleted",
      resourceType: "file",
      resourceId: fileId,
      eventId: file.scope === "event" ? file.scopeId : null,
      organizationId: file.scope === "organization" ? file.scopeId : null,
      metadata: { scope: file.scope, purpose: file.purpose, previousStatus: file.status },
      ipAddress: meta.ipAddress ?? null,
    });
  });
}

/** Files of a scope the actor can read (write access is required: listing exposes names). */
export async function listScopeFiles(actor: Actor, scope: FileScope, scopeId: string, opts: { purpose?: FilePurpose; limit?: number } = {}): Promise<FileStatusView[]> {
  await authorizeScopeWrite(actor, scope, scopeId, opts.purpose ?? "document");
  const where = [eq(files.scope, scope), eq(files.scopeId, scopeId), isNull(files.deletedAt)];
  if (opts.purpose) where.push(eq(files.purpose, opts.purpose));
  const rows = await db
    .select()
    .from(files)
    .where(and(...where))
    .orderBy(desc(files.createdAt))
    .limit(opts.limit ?? 100);
  return rows.map(toStatusView);
}

export type { FileRecord };
