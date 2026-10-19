import { DemoPhoto } from "@/components/shared/demo-photo";
import { cn } from "@/lib/utils";
import type { DemoPhoto as DemoPhotoEntry } from "@/modules/media/demo-photos";

/**
 * Signature photo shape of the public site: a soft rounded block with one
 * "feathered" corner, so every photograph reads as part of the same family.
 * The caption carries the honesty rule: demo photography is labelled as such.
 */
export function PhotoFrame({
  photo,
  caption,
  corner = "tl",
  className,
  aspect = "aspect-[4/3]",
  sizes,
  width,
  height,
  priority,
  alt,
}: {
  photo: DemoPhotoEntry;
  caption?: string;
  corner?: "tl" | "tr" | "bl" | "br";
  className?: string;
  aspect?: string;
  sizes?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  alt?: string;
}) {
  const cornerClass = { tl: "rounded-tl-[4.5rem]", tr: "rounded-tr-[4.5rem]", bl: "rounded-bl-[4.5rem]", br: "rounded-br-[4.5rem]" }[corner];
  return (
    <figure className={cn("m-0", className)}>
      <DemoPhoto photo={photo} className={cn("rounded-[1.75rem]", cornerClass, aspect)} sizes={sizes} width={width} height={height} priority={priority} alt={alt} />
      {caption && <figcaption className="mt-2 font-heading text-sm text-muted-foreground italic">{caption}</figcaption>}
    </figure>
  );
}

/** Small, consistent "this is demo data" marker. */
export function DemoLabel({ children = "Démonstration", className }: { children?: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-foreground", className)}>{children}</span>;
}
