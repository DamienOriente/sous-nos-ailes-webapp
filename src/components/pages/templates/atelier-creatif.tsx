import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Atelier créatif — decorators, workshops. Kraft paper background, sections
 * laid out like pinned sheets: slightly tilted, overlapping, with a tape strip.
 * The gallery is a collage of tilted prints.
 */
const VARIANTS: VariantMap = { hero: "split", about: "boxed", services: "steps", pricing: "inline", gallery: "collage", testimonials: "cards", faq: "cards", contact: "stacked", trust: "card", zone: "card", cta_quote: "boxed", availability: "grid" };

const TILTS = ["pg-tilt-c", "pg-tilt-b", "", "pg-tilt-a"];

export default function AtelierCreatif({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:font-bold" style={{ fontVariationSettings: '"wdth" 90' }}>
      <div className="pg-tex-linen">{hero && renderBlock(hero, ctx, VARIANTS)}</div>
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-5xl space-y-14 px-5 py-16 sm:px-8"
        wrap={(node, b, i) =>
          b.type === "gallery" || b.type === "cta_quote" ? (
            node
          ) : (
            <div className={`relative ${TILTS[i % TILTS.length]}`}>
              <span aria-hidden="true" className="absolute -top-3 left-1/2 z-10 h-6 w-28 -translate-x-1/2 rotate-[-3deg] bg-(--pg-accent) opacity-70" />
              <div className="bg-(--pg-surface) p-6 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.4)] sm:p-10">{node}</div>
            </div>
          )
        }
      />
      <TemplateFooter data={data} />
    </div>
  );
}
