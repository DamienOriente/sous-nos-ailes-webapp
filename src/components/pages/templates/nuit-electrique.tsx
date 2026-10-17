import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Nuit électrique — DJs, photobooths. Night background, colour halos, very
 * large bold titles; sections float as translucent panels with a glowing
 * border. Always dark, in both site modes.
 */
const VARIANTS: VariantMap = { hero: "glow", about: "boxed", services: "tiles", pricing: "cards", gallery: "mosaic", testimonials: "cards", faq: "cards", contact: "stacked", trust: "row", zone: "card", cta_quote: "band", availability: "grid" };

export default function NuitElectrique({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-bold [&_h2]:text-4xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:sm:text-5xl">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="pills" className="mx-auto mt-6 max-w-7xl px-5 sm:px-8 [&_a]:border-(--pg-accent)/40 [&_a]:bg-transparent" />
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-7xl space-y-8 px-5 py-14 sm:px-8"
        itemClassName={(b) => (["gallery", "cta_quote", "trust", "zone"].includes(b.type) ? "" : "rounded-(--pg-radius-lg) border border-(--pg-accent)/30 bg-(--pg-surface)/70 p-6 shadow-[0_0_60px_-30px_var(--pg-accent)] backdrop-blur sm:p-10")}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
