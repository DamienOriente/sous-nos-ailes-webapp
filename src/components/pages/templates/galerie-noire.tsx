import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Galerie noire: photographers, videographers. Dark exhibition room: the
 * fullscreen hero is followed by a masonry wall of prints; section titles are
 * small and muted like wall labels.
 */
const VARIANTS: VariantMap = { hero: "fullscreen", about: "two-column", services: "list", pricing: "table", gallery: "masonry", testimonials: "large", faq: "plain", contact: "panel", trust: "row", zone: "text", cta_quote: "split", availability: "compact" };

export default function GalerieNoire({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-light [&_h1]:tracking-[-0.03em] [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-(--pg-muted)">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="sticky" className="border-0" />
      <Sections ctx={ctx} blocks={blocks} variants={VARIANTS} className="mx-auto max-w-7xl px-5 sm:px-8" itemClassName={(b) => (b.type === "gallery" ? "py-12" : "mx-auto max-w-4xl py-16")} />
      <TemplateFooter data={data} />
    </div>
  );
}
