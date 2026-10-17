import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Minimal ivoire — one typeface, two columns on desktop: a sticky left column
 * (name, trade, section index) and the content on the right. No cards.
 */
const VARIANTS: VariantMap = { hero: "editorial", about: "prose", services: "list", pricing: "table", gallery: "grid", testimonials: "list", faq: "plain", contact: "minimal", trust: "list", zone: "text", cta_quote: "split", availability: "compact" };

export default function MinimalIvoire({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  const pro = data.professional;
  return (
    <div className="[&_h1]:font-semibold [&_h1]:tracking-[-0.04em] [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:sm:text-2xl">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-8 space-y-6 text-sm">
            <p className="font-semibold">{pro.displayName}</p>
            <p className="text-(--pg-muted)">
              {pro.categoryName}
              {pro.city ? <br /> : null}
              {pro.city}
            </p>
            <AnchorNav blocks={blocks} style="side" />
          </div>
        </aside>
        <Sections ctx={ctx} blocks={blocks} variants={VARIANTS} className="max-w-3xl space-y-20" />
      </div>
      <TemplateFooter data={data} />
    </div>
  );
}
