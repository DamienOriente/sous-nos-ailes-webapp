import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Sauge élégante: weddings. Split hero, Cormorant light titles, hairline
 * rules between sections, text set on a narrow measure.
 */
const VARIANTS: VariantMap = { hero: "split", about: "pullquote", services: "columns", pricing: "table", gallery: "duo", testimonials: "large", faq: "lines", contact: "panel", trust: "row", zone: "text", cta_quote: "split", availability: "compact" };

export default function SaugeElegante({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-light [&_h1]:tracking-[-0.02em] [&_h2]:font-light [&_h2]:tracking-[-0.01em]">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="inline" className="mx-auto mt-12 max-w-7xl border-y border-(--pg-border) px-5 py-3 sm:px-8" />
      <Sections ctx={ctx} blocks={blocks} variants={VARIANTS} className="mx-auto max-w-5xl divide-y divide-(--pg-border) px-5 sm:px-8" itemClassName="py-16 sm:py-20" />
      <TemplateFooter data={data} />
    </div>
  );
}
