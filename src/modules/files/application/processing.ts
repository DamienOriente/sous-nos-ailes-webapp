import { eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { db } from "@/db/client";
import { files, fileScanResults } from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { inspectOfficeArchive } from "@/modules/files/domain/office-archive";
import { inspectPdfBytes, inspectPdfDocument } from "@/modules/files/domain/pdf-heuristics";
import { mimeFamily, storageKey, variantKey, type FileScope, type FileStatus } from "@/modules/files/domain/policy";
import { logScanSkipped, scanBuffer, scanIsMandatory } from "@/modules/files/infrastructure/clamav";
import { inspectImage, processImage } from "@/modules/files/infrastructure/image-processor";
import { BUCKETS, copyObject, deleteObject, getObjectBuffer, putObject } from "@/modules/files/infrastructure/s3";
import { recordFileSecurityEvent } from "@/modules/files/infrastructure/security-log";

export class ScanUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanUnavailableError";
  }
}

/**
 * Steps 9–17: antivirus, heuristics, optimisation, promotion from the
 * quarantine bucket to the files bucket. Idempotent: a file that is no longer
 * quarantined/scanning is returned as is. Throws ScanUnavailableError when the
 * antivirus is mandatory but unreachable so the queue retries later; the file
 * stays in quarantine with status "scanning".
 */
export async function processFileNow(fileId: string): Promise<FileStatus> {
  const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file) throw new Error(`file ${fileId} not found`);
  if (file.status !== "quarantined" && file.status !== "scanning") return file.status;
  if (file.deletedAt) return file.status;

  await db.update(files).set({ status: "scanning" }).where(eq(files.id, fileId));
  const log = logger.child({ fileId, scope: file.scope, purpose: file.purpose });
  const bytes = await getObjectBuffer(file.bucket, file.storageKey);
  const scope = file.scope as FileScope;

  // 9. antivirus
  if (env.CLAMAV_ENABLED || env.APP_ENV === "production") {
    const verdict = await scanBuffer(bytes);
    if (verdict.verdict === "infected") {
      await db.insert(fileScanResults).values({ fileId, engine: "clamav", verdict: "infected", signature: verdict.signature });
      await reject(fileId, file.bucket, file.storageKey, "infected", `Fichier infecté (${verdict.signature}).`);
      await recordFileSecurityEvent("upload_infected", { userId: file.uploaderUserId, fileId, scope: file.scope, scopeId: file.scopeId, purpose: file.purpose, reason: verdict.signature });
      log.warn({ signature: verdict.signature }, "infected upload removed");
      return "infected";
    }
    if (verdict.verdict === "error") {
      await db.insert(fileScanResults).values({ fileId, engine: "clamav", verdict: "error", details: verdict.message.slice(0, 500) });
      if (scanIsMandatory()) {
        log.error({ err: verdict.message }, "antivirus unavailable, file kept in quarantine");
        throw new ScanUnavailableError(verdict.message);
      }
      logScanSkipped(fileId, verdict.message);
      await db.insert(fileScanResults).values({ fileId, engine: "clamav", verdict: "skipped", details: "clamav disabled outside production" });
    } else {
      await db.insert(fileScanResults).values({ fileId, engine: "clamav", verdict: "clean" });
    }
  } else {
    logScanSkipped(fileId, "CLAMAV_ENABLED=false");
    await db.insert(fileScanResults).values({ fileId, engine: "clamav", verdict: "skipped", details: "CLAMAV_ENABLED=false" });
  }

  // 10. content heuristics by family
  const family = mimeFamily(file.mimeType);
  let image: Awaited<ReturnType<typeof processImage>> | null = null;
  if (family === "pdf") {
    const heur = inspectPdfBytes(bytes);
    if (!heur.ok) {
      await policyReject(fileId, file, `Le PDF contient du contenu actif (${heur.token}).`, `pdf_token:${heur.token}`);
      return "rejected";
    }
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    } catch (err) {
      await policyReject(fileId, file, "Le document PDF est corrompu ou illisible.", `pdf_structure:${(err as Error).message.slice(0, 80)}`);
      return "rejected";
    }
    // Object streams hide names from the raw scan: inspect the parsed graph too.
    const structural = inspectPdfDocument(doc);
    if (!structural.ok) {
      await policyReject(fileId, file, `Le PDF contient du contenu actif (${structural.token}).`, `pdf_object:${structural.token}`);
      return "rejected";
    }
  } else if (family === "image") {
    const insp = await inspectImage(bytes);
    if (!insp.ok) {
      await policyReject(fileId, file, insp.reason, "image_invalid");
      return "rejected";
    }
    // 11–12. optimisation (EXIF rotation applied, metadata dropped, WebP variants)
    image = await processImage(bytes, file.mimeType);
  } else if (family === "office") {
    const archive = inspectOfficeArchive(bytes);
    if (!archive.ok) {
      await policyReject(fileId, file, archive.reason, `office_${archive.code}`);
      return "rejected";
    }
  } else {
    await policyReject(fileId, file, "Format de fichier non pris en charge.", "unknown_family");
    return "rejected";
  }
  await db.insert(fileScanResults).values({ fileId, engine: "policy", verdict: "clean" });

  // 14–15. final key, promotion to the files bucket, quarantine cleanup
  const finalKey = storageKey(scope, fileId, file.extension);
  const variants: Record<string, { key: string; width: number; height: number; sizeBytes: number }> = {};
  let finalSize = file.sizeBytes;
  let width: number | null = null;
  let height: number | null = null;
  if (image) {
    await putObject(BUCKETS.files, finalKey, image.original.buffer, image.original.mime);
    finalSize = image.original.buffer.length;
    width = image.original.width;
    height = image.original.height;
    for (const v of image.variants) {
      const key = variantKey(scope, fileId, v.name);
      await putObject(BUCKETS.files, key, v.buffer, "image/webp");
      variants[v.name] = { key, width: v.width, height: v.height, sizeBytes: v.buffer.length };
    }
  } else {
    // Contractual documents are stored byte-for-byte.
    await copyObject(file.bucket, file.storageKey, BUCKETS.files, finalKey, file.mimeType);
  }
  await deleteObject(file.bucket, file.storageKey).catch((err: unknown) => log.warn({ err: (err as Error).message }, "quarantine cleanup failed"));

  // 16. record
  await db
    .update(files)
    .set({ status: "clean", bucket: BUCKETS.files, storageKey: finalKey, sizeBytes: finalSize, width, height, variants, rejectionReason: null })
    .where(eq(files.id, fileId));
  log.info({ sizeBytes: finalSize, variants: Object.keys(variants) }, "file processed");
  return "clean";
}

async function policyReject(fileId: string, file: typeof files.$inferSelect, reason: string, code: string): Promise<void> {
  await db.insert(fileScanResults).values({ fileId, engine: "policy", verdict: "rejected", details: code.slice(0, 500) });
  await reject(fileId, file.bucket, file.storageKey, "rejected", reason);
  await recordFileSecurityEvent("upload_rejected", { userId: file.uploaderUserId, fileId, scope: file.scope, scopeId: file.scopeId, purpose: file.purpose, reason: code });
}

/** Rejected/infected bytes never stay in storage; only the metadata row remains for audit (purged after 7 days). */
async function reject(fileId: string, bucket: string, key: string, status: "rejected" | "infected", reason: string): Promise<void> {
  await deleteObject(bucket, key).catch((err: unknown) => logger.warn({ fileId, err: (err as Error).message }, "failed to delete quarantined object"));
  await db.update(files).set({ status, rejectionReason: reason.slice(0, 500) }).where(eq(files.id, fileId));
}
