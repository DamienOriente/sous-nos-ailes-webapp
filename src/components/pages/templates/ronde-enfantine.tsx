import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Ronde enfantine — children's entertainment. Handwritten display type, a
 * dotted paper background and scalloped dividers between coloured bands.
 */
const VARIANTS: VariantMap = { hero: "split", about: "boxed", services: "tiles", pricing: "inline", gallery: "band", testimonials: "cards", faq: "cards", contact: "stacked", trust: "row", zone: "map", cta_quote: "band", availability: "grid" };

function Scallop({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 1200 24" preserveAspectRatio="none" className={`h-6 w-full fill-(--pg-surface) ${flip ? "rotate-180" : ""}`} aria-hidden="true">
      <path d="M0 24 C 50 0, 100 0, 150 24 C 200 0, 250 0, 300 24 C 350 0, 400 0, 450 24 C 500 0, 550 0, 600 24 C 650 0, 700 0, 750 24 C 800 0, 850 0, 900 24 C 950 0, 1000 0, 1050 24 C 1100 0, 1150 0, 1200 24 Z" />
    </svg>
  );
}

export default function RondeEnfantine({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="pg-tex-dots [&_h1]:text-6xl [&_h1]:sm:text-8xl [&_h1]:font-bold [&_h2]:text-4xl">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="pills" className="mx-auto mt-10 max-w-6xl px-5 sm:px-8" />
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mt-12"
        wrap={(node, b, i) =>
          i % 2 === 1 ? (
            <div className="my-10">
              <Scallop />
              <div className="bg-(--pg-surface) py-14">
                <div className="mx-auto max-w-6xl px-5 sm:px-8">{node}</div>
              </div>
              <Scallop flip />
            </div>
          ) : (
            <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">{b.type === "cta_quote" ? <div className="-rotate-1">{node}</div> : node}</div>
          )
        }
      />
      <TemplateFooter data={data} />
    </div>
  );
}
