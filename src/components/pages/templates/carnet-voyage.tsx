import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Carnet de voyage: transport, lodgings, travelling entertainers. Handwritten
 * titles, sections separated by a plain rule, and the services presented as
 * the numbered legs of a journey.
 */
const VARIANTS: VariantMap = { hero: "split", about: "prose", services: "steps", pricing: "inline", gallery: "duo", testimonials: "list", faq: "plain", contact: "stacked", trust: "row", zone: "map", cta_quote: "boxed", availability: "compact" };

export default function CarnetVoyage({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:text-7xl [&_h1]:font-semibold [&_h1]:sm:text-8xl [&_h2]:text-4xl [&_h2]:font-semibold">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-4xl px-5 py-16 sm:px-8"
        wrap={(node) => <div className="border-t border-(--pg-border) py-10 first:border-0">{node}</div>}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
