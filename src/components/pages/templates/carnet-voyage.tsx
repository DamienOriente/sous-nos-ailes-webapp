import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Carnet de voyage — transport, lodgings, travelling entertainers. Ruled
 * paper, a handwritten title, a "stamp" per section in the margin and the
 * services presented as the legs of a journey.
 */
const VARIANTS: VariantMap = { hero: "split", about: "prose", services: "steps", pricing: "inline", gallery: "collage", testimonials: "list", faq: "plain", contact: "stacked", trust: "row", zone: "map", cta_quote: "boxed", availability: "compact" };

const STAMPS = ["rotate-[-6deg]", "rotate-[4deg]", "rotate-[-2deg]", "rotate-[7deg]"];

export default function CarnetVoyage({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="pg-tex-paper [&_h1]:text-7xl [&_h1]:font-semibold [&_h1]:sm:text-8xl [&_h2]:text-4xl [&_h2]:font-semibold">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-4xl px-5 py-16 sm:px-8"
        wrap={(node, b, i) => (
          <div className="relative py-10 md:pl-24">
            <span aria-hidden="true" className={`absolute top-10 left-0 hidden size-16 items-center justify-center border-2 border-dashed border-(--pg-accent) text-xs font-semibold text-(--pg-accent) uppercase md:flex ${STAMPS[i % STAMPS.length]}`}>
              {b.type === "zone" ? "zone" : b.type === "services" ? "trajet" : `n° ${i + 1}`}
            </span>
            {node}
          </div>
        )}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
