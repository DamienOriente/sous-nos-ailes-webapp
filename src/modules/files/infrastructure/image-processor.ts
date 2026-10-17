import sharp from "sharp";
import { IMAGE_MAX_DIMENSION, IMAGE_MAX_PIXELS, IMAGE_VARIANTS, WEBP_QUALITY } from "@/modules/files/domain/policy";

export type ImageInspection = { ok: true; width: number; height: number; format: string; pages: number } | { ok: false; reason: string };

/** Validates dimensions and refuses decompression bombs / animated images before any decoding. */
export async function inspectImage(buf: Buffer): Promise<ImageInspection> {
  try {
    const meta = await sharp(buf, { limitInputPixels: IMAGE_MAX_PIXELS, animated: false }).metadata();
    const { width, height } = meta;
    if (!width || !height) return { ok: false, reason: "Image illisible." };
    if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
      return { ok: false, reason: `Image trop grande (maximum ${IMAGE_MAX_DIMENSION} px de côté).` };
    }
    if (width * height > IMAGE_MAX_PIXELS) return { ok: false, reason: "Image trop grande (nombre de pixels)." };
    const pages = meta.pages ?? 1;
    if (pages > 1) return { ok: false, reason: "Les images animées ne sont pas acceptées." };
    return { ok: true, width, height, format: meta.format ?? "unknown", pages };
  } catch (err) {
    return { ok: false, reason: `Image invalide (${(err as Error).message.slice(0, 80)}).` };
  }
}

export type ProcessedImage = {
  /** Original re-encoded in its own format: EXIF orientation applied, all metadata dropped. */
  original: { buffer: Buffer; width: number; height: number; mime: string };
  variants: Array<{ name: string; buffer: Buffer; width: number; height: number }>;
};

const OUTPUT_MIME: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif" };

/**
 * Rotation is applied from EXIF then every metadata chunk is stripped (GPS,
 * camera serial, thumbnails...). Variants are WebP, never enlarged.
 */
export async function processImage(buf: Buffer, mime: string): Promise<ProcessedImage> {
  const base = () => sharp(buf, { limitInputPixels: IMAGE_MAX_PIXELS, animated: false }).rotate();
  const format = mime.replace("image/", "");
  let pipeline = base();
  switch (format) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality: 88, mozjpeg: true });
      break;
    case "png":
      pipeline = pipeline.png({ compressionLevel: 8 });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: 90 });
      break;
    case "avif":
      pipeline = pipeline.avif({ quality: 60 });
      break;
    case "gif":
      pipeline = pipeline.gif();
      break;
    default:
      throw new Error(`unsupported image format ${format}`);
  }
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const original = { buffer: data, width: info.width, height: info.height, mime: OUTPUT_MIME[format] ?? mime };

  const variants: ProcessedImage["variants"] = [];
  for (const v of IMAGE_VARIANTS) {
    if (v.width >= original.width && variants.length > 0) continue; // nothing larger than the original beyond the first
    const out = await base()
      .resize({ width: v.width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    variants.push({ name: v.name, buffer: out.data, width: out.info.width, height: out.info.height });
  }
  return { original, variants };
}
