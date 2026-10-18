import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Argentique: vintage print. Sepia paper, the hero framed like a mounted
 * photograph in a thick border, italic titles and a gallery laid out as a
 * contact-sheet strip on a dark flat band.
 */
const VARIANTS: VariantMap = { hero: "split", about: "prose", services: "list", pricing: "table", gallery: "filmstrip", testimonials: "list", faq: "plain", contact: "minimal", trust: "list", zone: "text", cta_quote: "split", availability: "compact" };

export default function Argentique({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-normal [&_h1]:italic [&_h2]:font-normal [&_h2]:italic">
      <div className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
        <div className="border-[12px] border-(--pg-surface)">{hero && renderBlock(hero, ctx, VARIANTS)}<div className="h-10" /></div>
      </div>
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-4xl px-5 sm:px-8"
        wrap={(node) => <div className="py-14">{node}</div>}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
