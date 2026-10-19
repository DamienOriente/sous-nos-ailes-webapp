import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Velours spectacle: magicians, clowns, cabaret. Dark theatre palette, centred
 * Cormorant titles in the accent colour, each section framed by a thin
 * neutral border like a programme page.
 */
const VARIANTS: VariantMap = { hero: "stacked", about: "prose", services: "cards", pricing: "cards", gallery: "grid", testimonials: "large", faq: "lines", contact: "stacked", trust: "row", zone: "text", cta_quote: "boxed", availability: "compact" };

export default function VeloursSpectacle({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-medium [&_h1]:text-(--pg-accent) [&_h2]:font-medium [&_h2]:text-(--pg-accent) [&_h2]:text-center">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-5xl space-y-12 px-5 py-16 sm:px-8"
        wrap={(node, b) => (b.type === "cta_quote" ? node : <div className="border border-(--pg-border) p-6 sm:p-12">{node}</div>)}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
