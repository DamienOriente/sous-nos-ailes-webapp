import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db/client";
import { files } from "@/db/schema";
import { IMAGE_VARIANTS, variantKey, WEBP_QUALITY, type FileScope } from "@/modules/files/domain/policy";
import { getObjectBuffer, putObject } from "@/modules/files/infrastructure/s3";

/**
 * Adds the 640 px "card" WebP variant to images processed before it existed.
 * Idempotent: files that already have it are skipped. Source is the smallest
 * stored rendition that is at least 640 px wide (never upscaled).
 */
async function main() {
  const width = IMAGE_VARIANTS.find((v) => v.name === "card")?.width ?? 640;
  const rows = await db.select().from(files).where(eq(files.status, "clean"));
  let done = 0;
  for (const f of rows) {
    if (!f.mimeType.startsWith("image/") || f.variants.card) continue;
    const source = [f.variants.medium, f.variants.large].find(Boolean) ?? Object.values(f.variants)[0];
    if (!source) continue;
    const input = await getObjectBuffer(f.bucket, source.key);
    const out = await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
    const key = variantKey(f.scope as FileScope, f.id, "card");
    await putObject(f.bucket, key, out.data, "image/webp");
    await db
      .update(files)
      .set({ variants: { ...f.variants, card: { key, width: out.info.width, height: out.info.height, sizeBytes: out.data.length } } })
      .where(eq(files.id, f.id));
    done += 1;
  }
  process.stdout.write(`card variant added to ${done} file(s)\n`);
  process.exit(0);
}

main().catch((err: unknown) => {
  process.stderr.write(`${(err as Error).message}\n`);
  process.exit(1);
});
