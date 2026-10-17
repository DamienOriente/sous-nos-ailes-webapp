import type { Block, PageContent } from "./page-schema";

/**
 * Attaches a listing's media library (media_assets rows) to its page content:
 * the cover becomes the hero picture, the first gallery photo illustrates the
 * "about" section, the gallery block lists every gallery photo. Pure and
 * idempotent: existing references are replaced only when they point to a
 * file that is no longer in the library (removed or replaced upload).
 */
export type MediaLibrary = {
  cover: { fileId: string; alt: string } | null;
  gallery: Array<{ fileId: string; alt: string; caption?: string | null }>;
};

export function bindMediaToContent(content: PageContent, library: MediaLibrary): PageContent {
  const known = new Set<string>([...library.gallery.map((g) => g.fileId), ...(library.cover ? [library.cover.fileId] : [])]);
  const keep = (id: string | undefined) => (id && known.has(id) ? id : undefined);
  const portrait = library.gallery[0] ?? null;
  return content.map((b): Block => {
    switch (b.type) {
      case "hero": {
        const current = keep(b.props.imageFileId);
        if (current) return b;
        const pick = library.cover ?? portrait;
        return pick ? { ...b, props: { ...b.props, imageFileId: pick.fileId, imageAlt: pick.alt } } : b;
      }
      case "about": {
        const current = keep(b.props.imageFileId);
        if (current) return b;
        return portrait ? { ...b, props: { ...b.props, imageFileId: portrait.fileId, imageAlt: portrait.alt } } : b;
      }
      case "gallery": {
        const kept = b.props.images.filter((img) => known.has(img.fileId));
        const have = new Set(kept.map((i) => i.fileId));
        const added = library.gallery.filter((g) => !have.has(g.fileId)).map((g) => ({ fileId: g.fileId, alt: g.alt, ...(g.caption ? { caption: g.caption } : {}) }));
        const images = [...kept, ...added].slice(0, 24);
        return { ...b, props: { ...b.props, images } };
      }
      default:
        return b;
    }
  });
}
