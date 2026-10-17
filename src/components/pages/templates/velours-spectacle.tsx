import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Velours spectacle — magicians, clowns, cabaret. A velvet curtain backdrop,
 * gilded Cormorant titles, sections presented as acts of a show, each framed
 * by a thin gold border like a programme page.
 */
const VARIANTS: VariantMap = { hero: "stacked", about: "prose", services: "cards", pricing: "cards", gallery: "grid", testimonials: "large", faq: "lines", contact: "stacked", trust: "row", zone: "text", cta_quote: "boxed", availability: "compact" };

export default function VeloursSpectacle({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="pg-tex-velvet [&_h1]:font-medium [&_h1]:text-(--pg-accent) [&_h2]:font-medium [&_h2]:text-(--pg-accent) [&_h2]:text-center">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        className="mx-auto max-w-5xl space-y-12 px-5 py-16 sm:px-8"
        wrap={(node, b, i) =>
          b.type === "cta_quote" ? (
            node
          ) : (
            <div className="relative border border-(--pg-accent)/50 p-6 sm:p-12">
              <p className="absolute -top-3 left-1/2 -translate-x-1/2 bg-(--pg-bg) px-3 text-xs tracking-[0.3em] text-(--pg-accent) uppercase" aria-hidden="true">
                Acte {["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][i] ?? i + 1}
              </p>
              {node}
            </div>
          )
        }
      />
      <TemplateFooter data={data} className="border-(--pg-accent)/30" />
    </div>
  );
}
