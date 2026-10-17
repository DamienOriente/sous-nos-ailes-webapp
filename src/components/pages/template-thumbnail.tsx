import { cn } from "@/lib/utils";
import { sampleRenderData, withSamplePhotos } from "@/modules/pages/domain/sample-content";
import type { PageRenderData } from "@/modules/pages/domain/render-data";
import { PageRenderer } from "./renderer";

/**
 * Miniature of a template: the real page rendered at desktop width and scaled
 * down with a CSS transform. No screenshots to maintain, always in sync with
 * the template code. Inert (no pointer events, hidden from assistive tech:
 * the caller provides the label).
 */
export function TemplateThumbnail({ templateKey, paletteKey, data, className, width = 1280, compact = true }: { templateKey: string; paletteKey?: string; data?: PageRenderData; className?: string; width?: number; /** Only the hero and the first sections: enough to show the structure, light enough for a grid of 24. */ compact?: boolean }) {
  const sample = data ?? (() => {
    const base = sampleRenderData(templateKey, paletteKey);
    return { ...base, content: withSamplePhotos(base.content, templateKey) };
  })();
  const content = compact ? sample.content.slice(0, 5) : sample.content;
  const render = { ...sample, content, templateKey, theme: paletteKey ? { ...sample.theme, palette: paletteKey } : sample.theme };
  return (
    <div className={cn("relative bg-muted [--thumb-scale:0.3]", className)} aria-hidden="true">
      <div className="pointer-events-none absolute inset-0 origin-top-left select-none" style={{ width, transform: `scale(var(--thumb-scale, 0.25))`, containerType: "inline-size" }}>
        <div style={{ width }} className="[&_.pg-root]:min-h-[1600px]">
          <PageRenderer data={render} mode="preview" />
        </div>
      </div>
    </div>
  );
}
