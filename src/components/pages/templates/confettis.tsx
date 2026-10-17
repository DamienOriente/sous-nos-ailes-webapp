import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Confettis — parties. Poster hero, then full-width coloured bands that
 * alternate (surface / accent-tinted / plain) with a running marquee of the
 * trade keywords between them. Loud by design, but only three colours.
 */
const VARIANTS: VariantMap = { hero: "poster", about: "two-column", services: "tiles", pricing: "cards", gallery: "mosaic", testimonials: "cards", faq: "cards", contact: "stacked", trust: "row", zone: "card", cta_quote: "band", availability: "grid" };

function Marquee({ words }: { words: string[] }) {
  const line = words.join("  ✦  ");
  return (
    <div className="overflow-hidden border-y-4 border-(--pg-text) py-3 text-xl font-bold uppercase tracking-tight" aria-hidden="true">
      <div className="pg-marquee gap-8">
        <span>{line}  ✦  </span>
        <span>{line}  ✦  </span>
      </div>
    </div>
  );
}

export default function Confettis({ data, ctx, blocks }: TemplateProps) {
  const hero = heroOf(blocks);
  const pro = data.professional;
  const words = [pro.categoryName, ...(pro.eventTypes.length ? pro.eventTypes : ["Anniversaires", "Mariages", "Séminaires"]), pro.city ?? "Partout"];
  return (
    <div className="[&_h1]:font-extrabold [&_h2]:text-4xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:sm:text-5xl">
      {hero && renderBlock(hero, ctx, VARIANTS)}
      <Marquee words={words} />
      <Sections
        ctx={ctx}
        blocks={blocks}
        variants={VARIANTS}
        wrap={(node, b, i) => (
          <div className={i % 3 === 1 ? "bg-(--pg-surface)" : i % 3 === 2 ? "bg-(--pg-accent-soft)" : ""}>
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">{node}</div>
          </div>
        )}
      />
      <Marquee words={words} />
      <TemplateFooter data={data} className="border-0" />
    </div>
  );
}
