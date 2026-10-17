import { AnchorNav } from "@/components/pages/blocks/anchor-nav";
import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Corporate net — venues, logistics, B2B. Low band hero, then a two-column
 * layout with a sticky table of contents on the left and regular information
 * panels on the right. Key facts (city, radius, price, experience) in a strip.
 */
const VARIANTS: VariantMap = { hero: "band", about: "prose", services: "table", pricing: "table", gallery: "grid", testimonials: "list", faq: "lines", contact: "panel", trust: "card", zone: "card", cta_quote: "split", availability: "grid" };

export default function CorporateNet({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  const pro = data.professional;
  const facts = [
    pro.city ? { k: "Basé à", v: pro.city } : null,
    pro.interventionRadiusKm > 0 ? { k: "Rayon d'intervention", v: `${pro.interventionRadiusKm} km` } : { k: "Accueil", v: "Sur place" },
    pro.priceFromCents ? { k: "À partir de", v: `${Math.round(pro.priceFromCents / 100)} €${pro.priceUnit ? ` / ${pro.priceUnit}` : ""}` } : null,
    pro.yearsExperience ? { k: "Expérience", v: `${pro.yearsExperience} ans` } : null,
    pro.languages.length ? { k: "Langues", v: pro.languages.map((l) => l.toUpperCase()).join(", ") } : null,
  ].filter((f): f is { k: string; v: string } => Boolean(f));
  return (
    <div className="[&_h1]:font-semibold [&_h2]:text-2xl [&_h2]:font-semibold">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-(--pg-border) px-5 sm:px-8 md:grid-cols-5">
        {facts.map((f) => (
          <div key={f.k} className="bg-(--pg-bg) px-4 py-4">
            <dt className="text-xs text-(--pg-muted)">{f.k}</dt>
            <dd className="font-medium">{f.v}</dd>
          </div>
        ))}
      </dl>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <p className="mb-3 text-xs font-semibold text-(--pg-muted)">Sommaire</p>
            <AnchorNav blocks={blocks} style="side" />
          </div>
        </aside>
        <Sections ctx={ctx} blocks={blocks} variants={VARIANTS} className="space-y-6" itemClassName={(b) => (["trust", "zone", "cta_quote"].includes(b.type) ? "" : "rounded-(--pg-radius-lg) border border-(--pg-border) bg-(--pg-surface) p-6 sm:p-8")} />
      </div>
      <TemplateFooter data={data} />
    </div>
  );
}
