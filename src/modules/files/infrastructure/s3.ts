import type { Readable } from "node:stream";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

/**
 * S3-compatible object storage (MinIO locally, Scaleway/OVH in production).
 * Both buckets are private: nothing is ever read without a presigned URL.
 */
const globalForS3 = globalThis as unknown as { __snaS3?: S3Client };

function create(): S3Client {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  });
}

export const s3: S3Client = globalForS3.__snaS3 ?? create();
if (env.APP_ENV !== "production") globalForS3.__snaS3 = s3;

export const BUCKETS = { files: env.S3_BUCKET, quarantine: env.S3_QUARANTINE_BUCKET } as const;

export async function putObject(bucket: string, key: string, body: Buffer | Readable, contentType: string, contentLength?: number): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: Buffer.isBuffer(body) ? body.length : contentLength,
      // Defensive: objects are never rendered inline by the storage itself.
      ContentDisposition: "attachment",
    }),
  );
}

export async function getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`empty body for ${bucket}/${key}`);
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function getObjectStream(bucket: string, key: string): Promise<{ stream: Readable; contentType: string | undefined; contentLength: number | undefined }> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`empty body for ${bucket}/${key}`);
  return { stream: res.Body as Readable, contentType: res.ContentType, contentLength: res.ContentLength };
}

export async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    if ((err as { name?: string }).name === "NotFound" || (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

export async function copyObject(fromBucket: string, fromKey: string, toBucket: string, toKey: string, contentType: string): Promise<void> {
  await s3.send(
    new CopyObjectCommand({
      Bucket: toBucket,
      Key: toKey,
      CopySource: `/${fromBucket}/${encodeURIComponent(fromKey).replace(/%2F/g, "/")}`,
      ContentType: contentType,
      ContentDisposition: "attachment",
      MetadataDirective: "REPLACE",
    }),
  );
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function deleteObjects(bucket: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  for (let i = 0; i < keys.length; i += 1000) {
    const slice = keys.slice(i, i + 1000);
    await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: slice.map((Key) => ({ Key })), Quiet: true } }));
  }
}

export async function listObjects(bucket: string, prefix: string): Promise<Array<{ key: string; lastModified: Date | undefined; size: number }>> {
  const out: Array<{ key: string; lastModified: Date | undefined; size: number }> = [];
  let token: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const o of (res.Contents ?? []) as _Object[]) {
      if (o.Key) out.push({ key: o.Key, lastModified: o.LastModified, size: o.Size ?? 0 });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

export type SignedUrlOptions = { expiresInSeconds: number; download?: { fileName: string } | null; contentType?: string };

/** Presigned GET. Private files: 5 min; public images: 1 h. */
export async function presignGet(bucket: string, key: string, opts: SignedUrlOptions): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: opts.contentType,
    ResponseContentDisposition: opts.download ? contentDisposition("attachment", opts.download.fileName) : "inline",
    ResponseCacheControl: "private, no-store",
  });
  return getSignedUrl(s3, cmd, { expiresIn: opts.expiresInSeconds });
}

/** RFC 6266 / 5987 safe Content-Disposition for arbitrary (UTF-8) names. */
export function contentDisposition(type: "attachment" | "inline", fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\;]/g, "_").slice(0, 120) || "fichier";
  const utf8 = encodeURIComponent(fileName.slice(0, 120)).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
