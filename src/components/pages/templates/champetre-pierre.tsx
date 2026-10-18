import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Champêtre pierre: venues and country caterers. Split hero, then long
 * horizontal bands: the gallery runs edge to edge like a stone wall and the
 * other sections sit on alternating stone and plain backgrounds.
 */
const VARIANTS: VariantMap = { hero: "split", about: "with-image", services: "columns", pricing: "table", gallery: "band", testimonials: "list", faq: "lines", contact: "panel", trust: "row", zone: "map", cta_quote: "split", availability: "grid" };

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
          <div className={b.type === "gallery" ? "bg-(--pg-surface) py-14" : i % 2 === 1 ? "bg-(--pg-surface)" : ""}>
            <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">{node}</div>
          </div>
        )}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
