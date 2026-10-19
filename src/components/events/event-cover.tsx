import { DemoPhoto } from "@/components/shared/demo-photo";
import { cn, initials } from "@/lib/utils";
import { resolveEventCover } from "@/modules/events/domain/cover";
import { privateFileHref } from "@/modules/files/application/file-urls";

type CoverSource = { id: string; type: string; name: string; coverPhotoId: string | null; coverFileId: string | null };

/**
 * Ambience picture of an event. Catalogue photos go through next/image; an
 * uploaded cover is served by the authenticated file route (signed URL after
 * the access check), so a plain <img> is used for it.
 */
export function EventCover({ event, className, sizes = "(max-width: 768px) 100vw, 60vw", priority = false, width = 1600, height = 700 }: { event: CoverSource; className?: string; sizes?: string; priority?: boolean; width?: number; height?: number }) {
  const cover = resolveEventCover(event);
  if (cover.kind === "file") {
    return (
      <div className={cn("relative overflow-hidden bg-muted", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated route redirecting to a short-lived signed URL */}
        <img src={privateFileHref(cover.fileId)} alt={`Photo de couverture de ${event.name}`} className="absolute inset-0 size-full object-cover" />
      </div>
    );
  }
  return <DemoPhoto photo={cover.photo} width={width} height={height} sizes={sizes} priority={priority} className={className} alt={`${cover.photo.alt} (photo d'ambiance)`} />;
}

const AVATAR_TONES = ["bg-sage-soft text-sage-deep", "bg-blush text-foreground", "bg-sky text-foreground", "bg-sand text-foreground", "bg-gold/60 text-foreground"];

/** Monogram avatar: deterministic tone from the name. */
export function Monogram({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const tone = AVATAR_TONES[h % AVATAR_TONES.length];
  const dims = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-10 text-sm" : "size-8 text-xs";
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-card", dims, tone, className)} title={name} aria-label={name}>
      {initials(name)}
    </span>
  );
}

/** Overlapping monograms of the team, with a "+n" tail. */
export function MemberAvatars({ names, max = 5, size = "sm", className }: { names: string[]; max?: number; size?: "sm" | "md"; className?: string }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className={cn("inline-flex items-center", className)} aria-label={`${names.length} membre${names.length > 1 ? "s" : ""} : ${names.join(", ")}`}>
      {shown.map((n, i) => (
        <Monogram key={`${n}-${i}`} name={n} size={size} className={i > 0 ? "-ml-2" : undefined} />
      ))}
      {rest > 0 && <span className={cn("-ml-2 inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-card", size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs")}>+{rest}</span>}
    </span>
  );
}

/** Thin progress bar with its label. One colour: the figures next to it carry the information. */
export function ProgressBar({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}
