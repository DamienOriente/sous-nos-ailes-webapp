import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Nature forêt — lodgings, green venues. Fullscreen landscape hero, then
 * "clearings": wide sections separated by generous vertical space and a
 * single hairline; the gallery sits on a deep-green band.
 */
const VARIANTS: VariantMap = { hero: "fullscreen", about: "with-image", services: "columns", pricing: "table", gallery: "mosaic", testimonials: "list", faq: "lines", contact: "panel", trust: "row", zone: "map", cta_quote: "split", availability: "grid" };

export default function NatureForet({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-medium [&_h2]:font-medium">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="sticky" />
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        wrap={(node, b) =>
          b.type === "gallery" ? (
            <div className="bg-(--pg-accent) py-14 text-(--pg-accent-contrast) [&_h2]:text-(--pg-accent-contrast)">
              <div className="mx-auto max-w-7xl px-5 sm:px-8">{node}</div>
            </div>
          ) : (
            <div className="mx-auto max-w-6xl border-b border-(--pg-border) px-5 py-20 last:border-0 sm:px-8">{node}</div>
          )
        }
      />
      <TemplateFooter data={data} />
    </div>
  );
}
