import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Poudre rose — beauty, flowers. Round portrait hero, italic Cormorant,
 * a thin gold-toned rule under every title, sections centred on a narrow
 * measure, gallery as two generous columns.
 */
const VARIANTS: VariantMap = { hero: "medallion", about: "prose", services: "columns", pricing: "cards", gallery: "duo", testimonials: "large", faq: "plain", contact: "minimal", trust: "row", zone: "text", cta_quote: "boxed", availability: "compact" };

export default function PoudreRose({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h2]:font-normal [&_h2]:italic [&_h2]:text-4xl [&_h2]:after:mt-3 [&_h2]:after:block [&_h2]:after:h-px [&_h2]:after:w-16 [&_h2]:after:bg-(--pg-accent) [&_h2]:after:content-['']">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="inline" className="mx-auto mt-14 max-w-4xl justify-center px-5 sm:px-8 [&_ul]:justify-center" />
      <Sections ctx={ctx} blocks={blocks} variants={VARIANTS} className="mx-auto max-w-4xl space-y-20 px-5 py-16 sm:px-8" />
      <TemplateFooter data={data} className="italic" />
    </div>
  );
}
