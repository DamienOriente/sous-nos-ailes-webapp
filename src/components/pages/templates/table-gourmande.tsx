import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Table gourmande — caterers, pastry. The page reads like a restaurant card:
 * centred hero, a double rule, services with dotted leaders, a photo ribbon,
 * all set in Fraunces for body and titles.
 */
const VARIANTS: VariantMap = { hero: "stacked", about: "prose", services: "menu", pricing: "table", gallery: "band", testimonials: "list", faq: "lines", contact: "minimal", trust: "row", zone: "text", cta_quote: "boxed", availability: "compact" };

function DoubleRule() {
  return (
    <div className="mx-auto my-12 max-w-3xl" aria-hidden="true">
      <div className="border-t-2 border-(--pg-text)" />
      <div className="mt-1 border-t border-(--pg-text)" />
    </div>
  );
}

export default function TableGourmande({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  return (
    <div className="[&_h1]:font-medium [&_h1]:italic [&_h2]:font-medium [&_h2]:italic">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <Sections ctx={ctx} blocks={blocks} variants={VARIANTS} className="mx-auto max-w-5xl px-5 sm:px-8" wrap={(node, b, i) => (
        <>
          {i > 0 && b.type !== "gallery" && <DoubleRule />}
          <div className={b.type === "gallery" ? "py-10" : ""}>{node}</div>
        </>
      )} />
      <TemplateFooter data={data} className="mt-12 italic" />
    </div>
  );
}
