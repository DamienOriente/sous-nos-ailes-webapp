import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Champêtre pierre — venues and country caterers. Split hero, then long
 * horizontal bands: the gallery runs edge to edge like a stone wall, sections
 * sit on alternating stone/plain backgrounds with a thin leaf motif.
 */
const VARIANTS: VariantMap = { hero: "split", about: "with-image", services: "columns", pricing: "table", gallery: "band", testimonials: "list", faq: "lines", contact: "panel", trust: "row", zone: "map", cta_quote: "split", availability: "grid" };

function Leaf() {
  return (
    <svg viewBox="0 0 48 24" className="mx-auto my-2 h-5 w-10 fill-none stroke-(--pg-accent) stroke-[1.5]" aria-hidden="true">
      <path d="M2 12 C 14 2, 34 2, 46 12 C 34 22, 14 22, 2 12 Z M2 12 H46" />
    </svg>
  );
}

export default function ChampetrePierre({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div>
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="sticky" className="mt-12" />
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        wrap={(node, b, i) => (
          <div className={b.type === "gallery" ? "bg-(--pg-surface) py-14" : i % 2 === 1 ? "bg-(--pg-surface)/60" : ""}>
            {b.type !== "gallery" && i > 0 && <Leaf />}
            <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">{node}</div>
          </div>
        )}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
