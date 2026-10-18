import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Terrasse azur: summer parties by the water. Fullscreen hero, alternating
 * bands in a pale blue tint, whitewashed panels on those bands, the gallery
 * as a scrolling band like a view from a terrace.
 */
const VARIANTS: VariantMap = { hero: "fullscreen", about: "two-column", services: "cards", pricing: "cards", gallery: "band", testimonials: "cards", faq: "cards", contact: "stacked", trust: "row", zone: "map", cta_quote: "band", availability: "grid" };

export default function TerrasseAzur({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-medium [&_h2]:font-medium">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="pills" className="mx-auto mt-8 max-w-7xl px-5 sm:px-8" />
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mt-8"
        wrap={(node, b, i) => (
          <div className={i % 2 === 1 ? "bg-(--pg-accent-soft) py-6" : ""}>
            <div className={`mx-auto max-w-7xl px-5 py-12 sm:px-8 ${i % 2 === 1 && b.type !== "gallery" ? "[&>*]:rounded-(--pg-radius-lg) [&>*]:bg-(--pg-surface) [&>*]:p-6 [&>*]:sm:p-10" : ""}`}>{node}</div>
          </div>
        )}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
