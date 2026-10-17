import { bodyBlocks, renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Moderne grille — a bento of tiles. The first body blocks are packed into a
 * grid of unequal cells (the first spans two columns); the rest follow as full
 * rows. Hard edges, one accent, Space Grotesk everywhere.
 */
const VARIANTS: VariantMap = { hero: "band", about: "boxed", services: "tiles", pricing: "cards", gallery: "grid", testimonials: "cards", faq: "cards", contact: "stacked", trust: "card", zone: "card", cta_quote: "band", availability: "grid" };

export default function ModerneGrille({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  const body = bodyBlocks(blocks, ctx);
  const grid = body.filter((b) => ["trust", "zone", "availability", "pricing", "about"].includes(b.type)).slice(0, 4);
  const rows = body.filter((b) => !grid.includes(b));
  return (
    <div className="[&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:font-bold [&_h2]:tracking-tight">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <div className="mx-auto max-w-7xl space-y-4 px-5 py-10 sm:px-8">
        {grid.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {grid.map((b, i) => (
              <div key={b.id} className={`rounded-(--pg-radius-lg) border border-(--pg-border) bg-(--pg-surface) p-6 ${i === 0 ? "md:col-span-2" : ""}`}>
                {renderBlock(b, ctx, { ...VARIANTS, about: "prose", trust: "row", zone: "text", pricing: "inline" })}
              </div>
            ))}
          </div>
        )}
        {rows.map((b) => (
          <div key={b.id} className={b.type === "cta_quote" ? "" : "rounded-(--pg-radius-lg) border border-(--pg-border) bg-(--pg-surface) p-6 sm:p-10"}>
            {renderBlock(b, ctx, VARIANTS)}
          </div>
        ))}
      </div>
      <TemplateFooter data={data} />
    </div>
  );
}
