import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Nid douillet — childcare. Centred, rounded, wool-toned. Every section sits in
 * its own soft card like a cushion; wide gutters, nothing sharp.
 */
const VARIANTS: VariantMap = { hero: "stacked", about: "with-image", services: "cards", pricing: "cards", gallery: "grid", testimonials: "cards", faq: "cards", contact: "stacked", trust: "card", zone: "card", cta_quote: "boxed", availability: "grid" };

export default function NidDouillet({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="pg-root-nid">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="pills" className="mx-auto mt-10 max-w-5xl px-5 sm:px-8" />
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-5xl space-y-6 px-5 py-12 sm:px-8 sm:py-16"
        itemClassName={(b) => (["about", "services", "gallery", "testimonials", "faq", "availability", "pricing"].includes(b.type) ? "rounded-(--pg-radius-xl) bg-(--pg-surface) p-6 shadow-[0_1px_0_var(--pg-border),0_24px_60px_-40px_rgba(0,0,0,0.25)] sm:p-10" : "")}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
