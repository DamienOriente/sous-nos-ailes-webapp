"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { publicImageHref } from "@/modules/files/application/file-urls";
import { isSampleFileId, Placeholder } from "./shared";

/**
 * Gallery thumbnails + the only interactive part of a public page besides the
 * FAQ: clicking a picture opens it in a dialog (keyboard: Esc, arrows).
 * `layout` is decided by the template; the markup stays the same.
 */
export type GalleryImage = { fileId?: string | null; alt: string; caption?: string };
export type GalleryLayout = "mosaic" | "band" | "grid" | "filmstrip" | "collage" | "masonry" | "plates" | "duo";

const TILT = ["pg-tilt-a", "pg-tilt-b", "pg-tilt-c"];

export function LightboxGallery({ images, layout = "grid", className }: { images: GalleryImage[]; layout?: GalleryLayout; className?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const close = useCallback(() => setIndex(null), []);
  const step = useCallback((d: number) => setIndex((i) => (i === null ? null : (i + d + images.length) % images.length)), [images.length]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, close, step]);

  const current = index === null ? null : images[index];

  const container: Record<GalleryLayout, string> = {
    mosaic: "grid grid-cols-2 gap-2 md:grid-cols-4 md:auto-rows-[180px]",
    band: "pg-scroll-x flex snap-x gap-3 pb-2",
    grid: "grid grid-cols-2 gap-3 md:grid-cols-3",
    filmstrip: "pg-film pg-scroll-x flex gap-4 px-6",
    collage: "grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-8 p-2",
    masonry: "pg-masonry",
    plates: "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
    duo: "grid grid-cols-1 gap-3 sm:grid-cols-2",
  };
  const item = (i: number): string => {
    switch (layout) {
      case "mosaic":
        return cn("aspect-square md:aspect-auto", i % 5 === 0 && "md:col-span-2 md:row-span-2", i % 5 === 3 && "md:col-span-2");
      case "band":
        return "h-56 w-72 shrink-0 snap-start sm:h-72 sm:w-96";
      case "filmstrip":
        return "h-48 w-64 shrink-0 border-4 border-(--pg-bg) sm:h-56 sm:w-80";
      case "collage":
        return cn("aspect-[4/5] bg-(--pg-surface) p-2 pb-8 shadow-lg", TILT[i % 3]);
      case "masonry":
        return cn(i % 3 === 0 ? "aspect-[3/4]" : i % 3 === 1 ? "aspect-square" : "aspect-[4/3]");
      case "plates":
        return "aspect-[4/5] border border-(--pg-border) bg-(--pg-surface) p-3 pb-10";
      case "duo":
        return "aspect-[4/3]";
      default:
        return "aspect-[4/3]";
    }
  };
  const radius = layout === "collage" || layout === "plates" || layout === "filmstrip" ? "" : "rounded-(--pg-radius-md)";

  return (
    <>
      <ul className={cn(container[layout], className)}>
        {images.map((img, i) => (
          <li key={`${img.fileId ?? "ph"}-${i}`} className={cn("relative", item(i))}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className={cn("group relative block h-full w-full overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pg-accent)", radius)}
              aria-label={`Agrandir : ${img.alt || `image ${i + 1}`}`}
            >
              {img.fileId && !isSampleFileId(img.fileId) ? (
                <Image src={publicImageHref(img.fileId, "medium")} alt={img.alt} fill sizes="(min-width: 768px) 33vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              ) : (
                <Placeholder className="absolute inset-0" seed={i} />
              )}
            </button>
            {(layout === "collage" || layout === "plates") && <p className={cn("absolute inset-x-3 bottom-2 truncate text-xs text-(--pg-muted)", layout === "collage" && "pg-heading text-sm")}>{img.caption ?? img.alt}</p>}
          </li>
        ))}
      </ul>
      {current && (
        <div role="dialog" aria-modal="true" aria-label={current.alt || "Image agrandie"} className="fixed inset-0 z-[90] flex flex-col bg-black/92 text-white" onClick={close}>
          <div className="flex items-center justify-between p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-white/70">
              {(index ?? 0) + 1} / {images.length}
            </p>
            <button type="button" onClick={close} className="rounded-full px-3 py-1.5 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white" autoFocus>
              Fermer
            </button>
          </div>
          <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
            {current.fileId && !isSampleFileId(current.fileId) ? <Image src={publicImageHref(current.fileId, "large")} alt={current.alt} fill sizes="100vw" className="object-contain" /> : <Placeholder className="absolute inset-6" seed={index ?? 0} />}
          </div>
          <div className="flex items-center justify-between gap-3 p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => step(-1)} className={cn("rounded-full px-4 py-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white", images.length < 2 && "invisible")}>
              Précédente
            </button>
            <p className="truncate text-center text-sm text-white/80">{current.caption ?? current.alt}</p>
            <button type="button" onClick={() => step(1)} className={cn("rounded-full px-4 py-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white", images.length < 2 && "invisible")}>
              Suivante
            </button>
          </div>
        </div>
      )}
    </>
  );
}
