import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Scène ouverte — musicians, performers. Concert poster: condensed display
 * type, a title that overflows, thick rules, sections stacked like the lines
 * of a bill (headliner, support, venue…).
 */
const VARIANTS: VariantMap = { hero: "poster", about: "two-column", services: "columns", pricing: "inline", gallery: "grid", testimonials: "large", faq: "lines", contact: "panel", trust: "row", zone: "text", cta_quote: "band", availability: "grid" };

export default function SceneOuverte({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-extrabold [&_h2]:font-extrabold [&_h2]:uppercase [&_h2]:tracking-tight [&_h2]:text-4xl [&_h2]:sm:text-6xl" style={{ fontVariationSettings: '"wdth" 80' }}>
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <Sections ctx={ctx} blocks={blocks} variants={VARIANTS} className="mx-auto max-w-6xl px-5 sm:px-8" wrap={(node, b) => <div className={`border-b-4 border-(--pg-text) py-14 ${b.type === "cta_quote" ? "border-0" : ""}`}>{node}</div>} />
      <TemplateFooter data={data} className="border-0 font-semibold uppercase tracking-widest" />
    </div>
  );
}
