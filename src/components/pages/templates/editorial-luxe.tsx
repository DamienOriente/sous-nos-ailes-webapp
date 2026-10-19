import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Éditorial luxe: magazine spread. Wide left margin on desktop, content on
 * the right nine columns of a twelve-column grid, a dark rule above each
 * section, no cards at all.
 */
const VARIANTS: VariantMap = { hero: "editorial", about: "two-column", services: "columns", pricing: "table", gallery: "masonry", testimonials: "large", faq: "lines", contact: "panel", trust: "list", zone: "text", cta_quote: "split", availability: "compact" };

export default function EditorialLuxe({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-normal [&_h2]:font-normal [&_h2]:tracking-[-0.02em] [&_h3]:font-normal">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-7xl px-5 sm:px-8"
        wrap={(node) => (
          <div className="grid border-t border-(--pg-text) py-14 md:grid-cols-12">
            <div className="md:col-span-9 md:col-start-4">{node}</div>
          </div>
        )}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
