import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Creates the private buckets when they do not exist (CI, fresh MinIO, new
 * S3 account). Idempotent. Uses the same variables as the application.
 */
async function main() {
  const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9010";
  const client = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? "fr-par",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") !== "false",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? "sna-minio", secretAccessKey: process.env.S3_SECRET_KEY ?? "sna-minio-local-only" },
  });
  const buckets = [process.env.S3_BUCKET ?? "sna-files", process.env.S3_QUARANTINE_BUCKET ?? "sna-quarantine"];
  // The storage service may still be starting (CI): wait up to ~60 s.
  for (let attempt = 1; ; attempt++) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: buckets[0]! }));
      break;
    } catch (err) {
      const name = (err as { name?: string }).name ?? "";
      if (name === "NotFound" || name === "NoSuchBucket" || (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) break;
      if (attempt >= 30) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  for (const Bucket of buckets) {
    try {
      await client.send(new HeadBucketCommand({ Bucket }));
      process.stdout.write(`bucket ${Bucket}: exists\n`);
    } catch {
      await client.send(new CreateBucketCommand({ Bucket }));
      process.stdout.write(`bucket ${Bucket}: created\n`);
    }
  }
}

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exit(1);
});
