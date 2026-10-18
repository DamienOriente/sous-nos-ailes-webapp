import { DEMO_PHOTOS, unsplashUrl, type DemoPhoto, type PhotoTheme, photosByTheme } from "@/modules/media/demo-photos";

/**
 * Sample images for template previews (gallery, picker, thumbnails). The page
 * schema only accepts UUIDs as file ids, so a demo photo is encoded as a
 * reserved "sample" UUID: `00000000-0000-4000-8000-0000000000NN` where NN is
 * the photo's index in the catalogue. Renderers recognise the prefix and load
 * the Unsplash picture instead of calling /api/files. Nothing with this prefix
 * can ever exist in the `files` table (v4 UUIDs never start with 12 zero bytes).
 */
export const SAMPLE_FILE_PREFIX = "00000000-0000-4000-8000-";

export const isSampleFileId = (id: string | null | undefined): boolean => Boolean(id && id.startsWith(SAMPLE_FILE_PREFIX));

export function sampleFileIdForPhoto(photo: DemoPhoto): string {
  const index = DEMO_PHOTOS.findIndex((p) => p.id === photo.id);
  return `${SAMPLE_FILE_PREFIX}${String(Math.max(0, index)).padStart(12, "0")}`;
}

/** The catalogue photo behind a sample id, or null for legacy sample ids without a photo (palette placeholder). */
export function samplePhotoFromFileId(id: string | null | undefined): DemoPhoto | null {
  if (!id || !isSampleFileId(id)) return null;
  const n = Number.parseInt(id.slice(SAMPLE_FILE_PREFIX.length), 10);
  if (!Number.isFinite(n)) return null;
  return DEMO_PHOTOS[n] ?? null;
}

const VARIANT_WIDTH = { thumb: 480, card: 800, medium: 1200, large: 1800, original: 2000 } as const;
export type SampleVariant = keyof typeof VARIANT_WIDTH;

export function sampleImageSrc(photo: DemoPhoto, variant: SampleVariant = "medium"): string {
  return unsplashUrl(photo.id, { w: VARIANT_WIDTH[variant] });
}

/** Distinct photos for a set of themes, round-robin so a gallery never repeats a picture. */
export function samplePhotosFor(themes: readonly PhotoTheme[], count: number): DemoPhoto[] {
  const pools = themes.map((t) => photosByTheme(t));
  const out: DemoPhoto[] = [];
  const seen = new Set<string>();
  let round = 0;
  while (out.length < count && round < 12) {
    for (const pool of pools) {
      const p = pool[round % Math.max(1, pool.length)];
      if (p && !seen.has(p.id) && pool.length > round) {
        seen.add(p.id);
        out.push(p);
        if (out.length >= count) break;
      }
    }
    round += 1;
  }
  return out;
}
