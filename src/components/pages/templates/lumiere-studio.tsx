import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Lumière studio: beauty, portrait. Pure white, oversized Bricolage Grotesque
 * headline, a services table like a price list on a studio wall, images in a
 * strict grid. Sections are separated by nothing but whitespace.
 */
const VARIANTS: VariantMap = { hero: "editorial", about: "prose", services: "table", pricing: "table", gallery: "grid", testimonials: "list", faq: "plain", contact: "minimal", trust: "row", zone: "text", cta_quote: "split", availability: "compact" };

export default function LumiereStudio({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-medium [&_h1]:tracking-[-0.05em] [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-(--pg-muted)">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="inline" className="mx-auto mt-4 max-w-7xl px-5 sm:px-8" />
      <Sections ctx={ctx} blocks={blocks} variants={VARIANTS} className="mx-auto max-w-7xl space-y-28 px-5 py-24 sm:px-8" itemClassName={(b) => (b.type === "gallery" ? "" : "mx-auto max-w-4xl")} />
      <TemplateFooter data={data} />
    </div>
  );
}
