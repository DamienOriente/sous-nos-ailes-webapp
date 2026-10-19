import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Ronde enfantine: children's entertainment. Handwritten display type and
 * flat coloured bands that alternate with plain sections.
 */
const VARIANTS: VariantMap = { hero: "split", about: "boxed", services: "tiles", pricing: "inline", gallery: "band", testimonials: "cards", faq: "cards", contact: "stacked", trust: "row", zone: "map", cta_quote: "band", availability: "grid" };

export default function RondeEnfantine({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:text-6xl [&_h1]:sm:text-8xl [&_h1]:font-bold [&_h2]:text-4xl">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="pills" className="mx-auto mt-10 max-w-6xl px-5 sm:px-8" />
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mt-12"
        wrap={(node, _b, i) => (
          <div className={i % 2 === 1 ? "bg-(--pg-surface) py-14" : "py-10"}>
            <div className="mx-auto max-w-6xl px-5 sm:px-8">{node}</div>
          </div>
        )}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
