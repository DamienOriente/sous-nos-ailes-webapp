import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Atelier créatif: decorators, workshops. Sections are sheets of paper with a
 * firm dark outline, bold condensed titles, and the gallery is a collage of
 * slightly tilted prints. No shadows, no textures.
 */
const VARIANTS: VariantMap = { hero: "split", about: "boxed", services: "steps", pricing: "inline", gallery: "collage", testimonials: "cards", faq: "cards", contact: "stacked", trust: "card", zone: "card", cta_quote: "boxed", availability: "grid" };

export default function AtelierCreatif({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:font-bold" style={{ fontVariationSettings: '"wdth" 90' }}>
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-5xl space-y-14 px-5 py-16 sm:px-8"
        wrap={(node, b) => (b.type === "gallery" || b.type === "cta_quote" ? node : <div className="border-2 border-(--pg-text) bg-(--pg-surface) p-6 sm:p-10">{node}</div>)}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
