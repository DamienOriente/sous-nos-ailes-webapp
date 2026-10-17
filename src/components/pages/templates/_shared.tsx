import { cn } from "@/lib/utils";
import type { Block } from "@/modules/pages/domain/page-schema";
import type { PageRenderData } from "@/modules/pages/domain/render-data";
import { bodyBlocks, renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import type { BlockContext } from "@/components/pages/blocks/shared";

/** What every template component receives. */
export type TemplateProps = { data: PageRenderData; ctx: BlockContext; blocks: Block[] };

export function heroOf(blocks: Block[]): Block | undefined {
  return blocks.find((b) => b.type === "hero" && !b.hidden);
}

/**
 * Renders the body blocks in order with a per-template wrapper. `wrap` lets a
 * template alternate backgrounds, insert separators or group blocks without
 * re-implementing the loop.
 */
export function Sections({
  ctx,
  blocks,
  variants,
  className,
  itemClassName,
  wrap,
}: {
  ctx: BlockContext;
  blocks: Block[];
  variants: VariantMap;
  className?: string;
  itemClassName?: string | ((block: Block, index: number) => string);
  wrap?: (node: React.ReactNode, block: Block, index: number) => React.ReactNode;
}) {
  const body = bodyBlocks(blocks, ctx);
  return (
    <div className={className}>
      {body.map((b, i) => {
        const node = renderBlock(b, ctx, variants);
        const cls = typeof itemClassName === "function" ? itemClassName(b, i) : itemClassName;
        const inner = cls ? <div className={cn(cls)}>{node}</div> : node;
        return <div key={b.id}>{wrap ? wrap(inner, b, i) : inner}</div>;
      })}
    </div>
  );
}

/** Small footer line common to every template: platform mention + demo notice are handled by the route. */
export function TemplateFooter({ data, className }: { data: PageRenderData; className?: string }) {
  return (
    <footer className={cn("border-t border-(--pg-border) py-8 text-center text-xs text-(--pg-muted)", className)}>
      <p>
        {data.professional.displayName} · {data.professional.categoryName}
        {data.professional.city ? ` · ${data.professional.city}` : ""} · page créée avec Sous Nos Ailes
      </p>
    </footer>
  );
}
