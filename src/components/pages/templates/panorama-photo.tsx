import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Panorama photo — photographers, venues. Fullscreen hero, sticky anchored
 * nav, mosaic gallery edge to edge; text sections stay narrow and quiet so
 * the pictures carry the page.
 */
const VARIANTS: VariantMap = { hero: "fullscreen", about: "two-column", services: "list", pricing: "table", gallery: "mosaic", testimonials: "large", faq: "lines", contact: "panel", trust: "row", zone: "text", cta_quote: "split", availability: "compact" };

export default function PanoramaPhoto({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-semibold [&_h2]:font-medium">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <AnchorNav blocks={blocks} style="sticky" />
      <Sections ctx={ctx} blocks={blocks} variants={VARIANTS} className="mx-auto max-w-7xl px-5 sm:px-8" itemClassName={(b) => (b.type === "gallery" ? "py-10" : "mx-auto max-w-5xl py-16 sm:py-20")} />
      <TemplateFooter data={data} />
    </div>
  );
}
