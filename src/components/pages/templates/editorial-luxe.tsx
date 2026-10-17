import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Éditorial luxe — magazine spread. Twelve-column grid: section titles sit in
 * the left three columns as running heads, content spans the right nine.
 * Thin rules, numbered folios, no cards at all.
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
        wrap={(node, _b, i) => (
          <div className="grid gap-6 border-t border-(--pg-border) py-14 md:grid-cols-12">
            <p className="text-xs tabular-nums text-(--pg-muted) md:col-span-1" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </p>
            <div className="md:col-span-11">{node}</div>
          </div>
        )}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
