import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Jardin fleuri: florists, decorators. A herbarium: pictures mounted as
 * plates with a caption, sections bordered by a thin double frame, titles in
 * Fraunces with soft serifs.
 */
const VARIANTS: VariantMap = { hero: "stacked", about: "with-image", services: "columns", pricing: "table", gallery: "plates", testimonials: "cards", faq: "lines", contact: "panel", trust: "row", zone: "map", cta_quote: "boxed", availability: "compact" };

export default function JardinFleuri({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-medium [&_h2]:font-medium" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}>
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="inline" className="mx-auto mt-12 max-w-6xl px-5 sm:px-8" />
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8"
        itemClassName={(b) => (["gallery", "cta_quote", "trust"].includes(b.type) ? "" : "border border-(--pg-border) p-1 [&>*]:border [&>*]:border-(--pg-border) [&>*]:p-6 [&>*]:sm:p-10")}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
