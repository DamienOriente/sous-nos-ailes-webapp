import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Argentique — vintage print. Sepia paper with grain, the hero framed like a
 * mounted photograph, a film-strip gallery, and section titles set as
 * contact-sheet captions ("planche 03").
 */
const VARIANTS: VariantMap = { hero: "split", about: "prose", services: "list", pricing: "table", gallery: "filmstrip", testimonials: "list", faq: "plain", contact: "minimal", trust: "list", zone: "text", cta_quote: "split", availability: "compact" };

export default function Argentique({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="pg-tex-grain relative [&_h1]:font-normal [&_h1]:italic [&_h2]:font-normal [&_h2]:italic">
      <div className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
        <div className="border-[12px] border-(--pg-surface) shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]">{hero && renderBlock(hero, ctx, VARIANTS)}<div className="h-10" /></div>
      </div>
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-4xl px-5 sm:px-8"
        wrap={(node, _b, i) => (
          <div className="py-14">
            <p className="mb-4 text-xs tabular-nums tracking-widest text-(--pg-muted) uppercase" aria-hidden="true">
              planche {String(i + 1).padStart(2, "0")}
            </p>
            {node}
          </div>
        )}
      />
      <TemplateFooter data={data} />
    </div>
  );
}
