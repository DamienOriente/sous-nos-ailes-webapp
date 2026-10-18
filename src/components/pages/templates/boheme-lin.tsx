import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Bohème lin: round portrait, sections that alternate left and right of the
 * page like the pages of a notebook, a gallery in three uneven columns.
 */
const VARIANTS: VariantMap = { hero: "medallion", about: "prose", services: "steps", pricing: "inline", gallery: "masonry", testimonials: "large", faq: "plain", contact: "stacked", trust: "row", zone: "map", cta_quote: "boxed", availability: "compact" };

export default function BohemeLin({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-medium [&_h1]:not-italic [&_h2]:font-medium">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="inline" className="mx-auto mt-14 max-w-5xl px-5 sm:px-8" />
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-6xl space-y-20 px-5 py-16 sm:px-8"
        itemClassName={(b, i) => (b.type === "gallery" || b.type === "cta_quote" ? "" : i % 2 === 0 ? "md:mr-[12%]" : "md:ml-[12%]")}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
