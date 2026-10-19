import Image from "next/image";
import { cn } from "@/lib/utils";
import { unsplashUrl, type DemoPhoto as DemoPhotoEntry } from "@/modules/media/demo-photos";

/**
 * Photograph from the demo catalogue rendered with next/image. The tone colour
 * fills the box until the image loads (no layout shift, no grey flash).
 */
export function DemoPhoto({
  photo,
  width = 1200,
  height,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
  className,
  imgClassName,
  alt,
}: {
  photo: DemoPhotoEntry;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  /** Override when the surrounding context gives a more specific description. */
  alt?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ backgroundColor: photo.tone }}>
      <Image
        src={unsplashUrl(photo.id, { w: width, h: height })}
        alt={alt ?? photo.alt}
        fill
        sizes={sizes}
        priority={priority}
        fetchPriority={priority ? "high" : undefined}
        className={cn("object-cover", imgClassName)}
      />
    </div>
  );
}
