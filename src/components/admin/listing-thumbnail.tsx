import { TemplateThumbnail } from "@/components/pages/template-thumbnail";
import { DemoPhoto } from "@/components/shared/demo-photo";
import { cn } from "@/lib/utils";
import { privateFileHref } from "@/modules/files/application/file-urls";
import { categoryPhoto } from "@/modules/media/demo-photos";

/**
 * Small visual of a listing for the moderation queue: the cover uploaded by
 * the professional (through the authenticated file route — moderators are
 * allowed to view it), else an ambience photo of the trade, plus a miniature
 * of the page template awaiting review.
 */
export function ListingThumbnail({ coverFileId, categorySlug, templateKey, className }: { coverFileId: string | null; categorySlug: string | null; templateKey: string | null; className?: string }) {
  const fallback = categoryPhoto(categorySlug ?? "reception", 0);
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)} aria-hidden="true">
      <div className="relative h-12 w-16 overflow-hidden rounded-md border bg-muted">
        {coverFileId ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated file route, signed redirect
          <img src={privateFileHref(coverFileId)} alt="" className="size-full object-cover" style={{ backgroundColor: fallback.tone }} />
        ) : (
          <DemoPhoto photo={fallback} width={160} height={120} sizes="64px" className="absolute inset-0" alt="" />
        )}
      </div>
      {templateKey && <TemplateThumbnail templateKey={templateKey} className="h-12 w-16 overflow-hidden rounded-md border [--thumb-scale:0.05]" />}
    </div>
  );
}
