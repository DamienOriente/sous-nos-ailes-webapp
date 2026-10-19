import { DEMO_PHOTOS, EVENT_PHOTO_THEMES, eventPhoto, photosByTheme, type DemoPhoto } from "@/modules/media/demo-photos";

/**
 * Cover picture of an event — pure helpers. An event shows either a photo of
 * the demo catalogue (`coverPhotoId`) or a file uploaded by the organiser
 * (`coverFileId`, served through the authenticated file route). The uploaded
 * file always wins; a missing/unknown catalogue id falls back to a
 * deterministic pick so two sibling events rarely share the same picture.
 */
export type EventCover = { kind: "catalog"; photo: DemoPhoto } | { kind: "file"; fileId: string };

type CoverSource = { id: string; type: string; coverPhotoId: string | null; coverFileId: string | null };

/** Small stable hash (FNV-1a) so the default pick only depends on the event id. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Every catalogue photo matching the themes of an event type (settings picker). */
export function coverCatalog(eventType: string): DemoPhoto[] {
  const themes = EVENT_PHOTO_THEMES[eventType] ?? ["confetti"];
  const seen = new Set<string>();
  const out: DemoPhoto[] = [];
  for (const theme of themes) {
    for (const p of photosByTheme(theme)) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
    }
  }
  return out.length ? out : [eventPhoto(eventType, 0)];
}

export function defaultCoverPhotoId(eventType: string, seed: string): string {
  const list = coverCatalog(eventType);
  return list[hashSeed(seed) % list.length]?.id ?? eventPhoto(eventType, 0).id;
}

export function isCatalogPhotoId(id: string): boolean {
  return DEMO_PHOTOS.some((p) => p.id === id);
}

export function resolveEventCover(e: CoverSource): EventCover {
  if (e.coverFileId) return { kind: "file", fileId: e.coverFileId };
  const chosen = e.coverPhotoId ? DEMO_PHOTOS.find((p) => p.id === e.coverPhotoId) : undefined;
  if (chosen) return { kind: "catalog", photo: chosen };
  const fallback = DEMO_PHOTOS.find((p) => p.id === defaultCoverPhotoId(e.type, e.id)) ?? eventPhoto(e.type, 0);
  return { kind: "catalog", photo: fallback };
}
