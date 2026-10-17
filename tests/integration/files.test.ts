import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { db } from "@/db/client";
import { fileAccessLogs, files, fileScanResults, securityEvents, users } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { deleteFile, getFileStatus, issueFileUrl } from "@/modules/files/application/file-service";
import { processFileNow } from "@/modules/files/application/processing";
import { createUpload } from "@/modules/files/application/upload-service";
import { isValidStorageKey, quarantineKey } from "@/modules/files/domain/policy";
import { scanBuffer } from "@/modules/files/infrastructure/clamav";
import { BUCKETS, getObjectBuffer, objectExists, putObject } from "@/modules/files/infrastructure/s3";

/**
 * Scenario E — end-to-end against the local MinIO + ClamAV containers.
 * Requires `docker compose up -d db redis minio clamav` and CLAMAV_ENABLED=true.
 */
const EICAR = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*", "latin1");
const run = randomUUID().slice(0, 8);

function actorOf(id: string, email: string): Actor {
  return { userId: id, email, name: `itest ${id.slice(0, 4)}`, globalRole: "user", emailVerified: true, isDemo: true };
}

const userA = `itest-files-a-${run}`;
const userB = `itest-files-b-${run}`;
const actorA = actorOf(userA, `${userA}@sousnosailes.test`);
const actorB = actorOf(userB, `${userB}@sousnosailes.test`);

async function makeJpegWithExif(width = 2400, height = 1600): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 107, g: 143, b: 113 } } })
    .jpeg({ quality: 90 })
    // Orientation 6 = rotate 90° clockwise when displayed; GPS-like tags must disappear.
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Copyright: "itest", ImageDescription: "contains-metadata" }, IFD3: { GPSLatitudeRef: "N" } })
    .toBuffer();
}

async function makePdf(withJs: boolean): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  page.drawText("itest", { x: 20, y: 250, size: 20 });
  if (withJs) doc.addJavaScript("evil", "app.alert('x')");
  return Buffer.from(await doc.save());
}

beforeAll(async () => {
  await db.insert(users).values([
    { id: userA, name: "Itest A", email: actorA.email, emailVerified: true, isDemo: true },
    { id: userB, name: "Itest B", email: actorB.email, emailVerified: true, isDemo: true },
  ]);
});

afterAll(async () => {
  const rows = await db.select({ id: files.id, bucket: files.bucket, storageKey: files.storageKey, variants: files.variants }).from(files).where(inArray(files.uploaderUserId, [userA, userB]));
  const { deleteObjects } = await import("@/modules/files/infrastructure/s3");
  for (const r of rows) await deleteObjects(r.bucket, [r.storageKey, ...Object.values(r.variants ?? {}).map((v) => v.key)]).catch(() => undefined);
  await db.delete(securityEvents).where(inArray(securityEvents.userId, [userA, userB]));
  await db.delete(files).where(inArray(files.uploaderUserId, [userA, userB]));
  await db.delete(users).where(inArray(users.id, [userA, userB]));
});

describe("Scenario E — secure file pipeline", () => {
  let imageId = "";
  let imageBytes: Buffer;

  it("stores a valid image in quarantine first", async () => {
    imageBytes = await makeJpegWithExif();
    const res = await createUpload(actorA, { scope: "user", scopeId: userA, purpose: "avatar", originalName: "Photo de profil.JPG", bytes: imageBytes }, { process: "none" });
    imageId = res.id;
    expect(res.status).toBe("quarantined");
    expect(res.mimeType).toBe("image/jpeg");
    const [row] = await db.select().from(files).where(eq(files.id, imageId));
    expect(row?.bucket).toBe(BUCKETS.quarantine);
    expect(row?.storageKey).toBe(quarantineKey(imageId));
    expect(row?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await objectExists(BUCKETS.quarantine, quarantineKey(imageId))).toBe(true);
    // Not accessible while not clean, even for the owner.
    await expect(issueFileUrl(actorA, imageId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("scans, optimises (EXIF removed, orientation applied, WebP variants) and promotes to the files bucket", async () => {
    const status = await processFileNow(imageId);
    expect(status).toBe("clean");
    const [row] = await db.select().from(files).where(eq(files.id, imageId));
    expect(row?.status).toBe("clean");
    expect(row?.bucket).toBe(BUCKETS.files);
    expect(row?.storageKey).toBe(`f/user/${imageId}.jpg`);
    expect(isValidStorageKey(row!.storageKey)).toBe(true);
    expect(row!.storageKey).not.toContain("Photo");
    // Orientation 6 applied → dimensions swapped.
    expect(row?.width).toBe(1600);
    expect(row?.height).toBe(2400);
    // After rotation the width is 1600: "large" (1920) would upscale, so it is not generated.
    expect(Object.keys(row!.variants).sort()).toEqual(["medium", "thumb"]);
    expect(row!.variants.thumb?.width).toBe(320);
    expect(row!.variants.medium?.width).toBe(1024);
    expect(row!.variants.large).toBeUndefined();

    const stored = await getObjectBuffer(BUCKETS.files, row!.storageKey);
    const meta = await sharp(stored).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(stored.includes(Buffer.from("contains-metadata"))).toBe(false);
    const thumb = await sharp(await getObjectBuffer(BUCKETS.files, row!.variants.thumb!.key)).metadata();
    expect(thumb.format).toBe("webp");
    expect(await objectExists(BUCKETS.quarantine, quarantineKey(imageId))).toBe(false);

    const scans = await db.select().from(fileScanResults).where(eq(fileScanResults.fileId, imageId));
    expect(scans.map((s) => `${s.engine}:${s.verdict}`).sort()).toEqual(["clamav:clean", "policy:clean"]);
  });

  it("grants the owner a short-lived signed URL that actually serves the bytes", async () => {
    const { url, fileName } = await issueFileUrl(actorA, imageId, { download: true });
    expect(fileName).toBe("Photo de profil.JPG");
    const u = new URL(url);
    expect(u.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(u.pathname).toContain(`/f/user/${imageId}.jpg`);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.length).toBeGreaterThan(1000);
    const status = await getFileStatus(actorA, imageId);
    expect(status.status).toBe("clean");
    expect(status.variants).toContain("thumb");
  });

  it("denies another user with a 404-equivalent and logs the denial", async () => {
    await expect(issueFileUrl(actorB, imageId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getFileStatus(actorB, imageId)).rejects.toBeInstanceOf(NotFoundError);
    const denied = await db.select().from(fileAccessLogs).where(and(eq(fileAccessLogs.fileId, imageId), eq(fileAccessLogs.action, "denied")));
    expect(denied.length).toBeGreaterThanOrEqual(1);
    const events = await db.select().from(securityEvents).where(and(eq(securityEvents.userId, userB), eq(securityEvents.type, "file_access_denied")));
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects an executable renamed .jpg before storing anything", async () => {
    const fakeJpg = Buffer.concat([Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00", "latin1"), Buffer.alloc(300, 0x90)]);
    await expect(createUpload(actorA, { scope: "user", scopeId: userA, purpose: "avatar", originalName: "photo.jpg", bytes: fakeJpg })).rejects.toBeInstanceOf(ValidationError);
    const rows = await db.select({ id: files.id }).from(files).where(and(eq(files.uploaderUserId, userA), eq(files.originalName, "photo.jpg")));
    expect(rows).toHaveLength(0);
    const [ev] = await db.select().from(securityEvents).where(and(eq(securityEvents.userId, userA), eq(securityEvents.type, "upload_rejected")));
    expect(ev).toBeDefined();
  });

  it("rejects the EICAR string uploaded as .txt (type not allowed) and ClamAV flags the bytes", async () => {
    await expect(createUpload(actorA, { scope: "user", scopeId: userA, purpose: "document", originalName: "eicar.txt", bytes: EICAR })).rejects.toBeInstanceOf(ValidationError);
    const verdict = await scanBuffer(EICAR);
    expect(verdict.verdict).toBe("infected");
    if (verdict.verdict === "infected") expect(verdict.signature.toLowerCase()).toContain("eicar");
  });

  it("marks a quarantined infected file as infected, removes the bytes and never serves it", async () => {
    // Bypass the static policy to reach the antivirus step with a known-bad payload.
    const id = randomUUID();
    await putObject(BUCKETS.quarantine, quarantineKey(id), EICAR, "application/pdf");
    await db.insert(files).values({
      id,
      uploaderUserId: userA,
      scope: "user",
      scopeId: userA,
      purpose: "document",
      status: "quarantined",
      bucket: BUCKETS.quarantine,
      storageKey: quarantineKey(id),
      originalName: "eicar.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      sizeBytes: EICAR.length,
      sha256: "0".repeat(64),
    });
    const status = await processFileNow(id);
    expect(status).toBe("infected");
    const [row] = await db.select().from(files).where(eq(files.id, id));
    expect(row?.status).toBe("infected");
    expect(row?.rejectionReason).toMatch(/infecté/i);
    expect(await objectExists(BUCKETS.quarantine, quarantineKey(id))).toBe(false);
    expect(await objectExists(BUCKETS.files, `f/user/${id}.pdf`)).toBe(false);
    await expect(issueFileUrl(actorA, id)).rejects.toBeInstanceOf(NotFoundError);
    const [ev] = await db.select().from(securityEvents).where(and(eq(securityEvents.userId, userA), eq(securityEvents.type, "upload_infected")));
    expect(ev?.severity).toBe("high");
    // Re-processing is idempotent.
    expect(await processFileNow(id)).toBe("infected");
  });

  it("accepts a clean PDF unchanged and rejects a PDF with JavaScript", async () => {
    const good = await makePdf(false);
    const okRes = await createUpload(actorA, { scope: "user", scopeId: userA, purpose: "document", originalName: "devis.pdf", bytes: good }, { process: "inline" });
    expect(okRes.status).toBe("clean");
    const stored = await getObjectBuffer(BUCKETS.files, `f/user/${okRes.id}.pdf`);
    expect(stored.equals(good)).toBe(true); // contractual documents are never modified

    const bad = await makePdf(true);
    const badRes = await createUpload(actorA, { scope: "user", scopeId: userA, purpose: "document", originalName: "piege.pdf", bytes: bad }, { process: "inline" });
    expect(badRes.status).toBe("rejected");
    expect(badRes.rejectionReason).toMatch(/JavaScript|\/JS/);
    expect(await objectExists(BUCKETS.quarantine, quarantineKey(badRes.id))).toBe(false);
    await expect(issueFileUrl(actorA, badRes.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("deduplicates identical bytes within a scope only", async () => {
    const again = await createUpload(actorA, { scope: "user", scopeId: userA, purpose: "avatar", originalName: "copie.jpg", bytes: imageBytes });
    expect(again.deduplicated).toBe(true);
    expect(again.id).toBe(imageId);
    const other = await createUpload(actorB, { scope: "user", scopeId: userB, purpose: "avatar", originalName: "copie.jpg", bytes: imageBytes }, { process: "none" });
    expect(other.deduplicated).toBe(false);
    expect(other.id).not.toBe(imageId);
  });

  it("refuses uploads into a scope the actor does not own", async () => {
    await expect(createUpload(actorB, { scope: "user", scopeId: userA, purpose: "avatar", originalName: "x.jpg", bytes: imageBytes })).rejects.toBeInstanceOf(NotFoundError);
    await expect(createUpload(actorB, { scope: "professional", scopeId: randomUUID(), purpose: "logo", originalName: "x.jpg", bytes: imageBytes })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("soft deletes and removes every stored object", async () => {
    const [before] = await db.select().from(files).where(eq(files.id, imageId));
    await deleteFile(actorA, imageId);
    const [row] = await db.select().from(files).where(eq(files.id, imageId));
    expect(row?.status).toBe("deleted");
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect(await objectExists(BUCKETS.files, before!.storageKey)).toBe(false);
    for (const v of Object.values(before!.variants)) expect(await objectExists(BUCKETS.files, v.key)).toBe(false);
    await expect(issueFileUrl(actorA, imageId)).rejects.toBeInstanceOf(NotFoundError);
  });
});
