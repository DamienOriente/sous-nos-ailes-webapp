import { renderBlock, type VariantMap } from "@/components/pages/blocks/render-block";
import { heroOf, Sections, TemplateFooter, type TemplateProps } from "./_shared";

/**
 * Confettis: parties. Poster hero, then full-width coloured bands that
 * alternate (surface / accent-tinted / plain), with a static line of the
 * trade keywords between hero and body. Loud by design, but only three colours.
 */
const VARIANTS: VariantMap = { hero: "poster", about: "two-column", services: "tiles", pricing: "cards", gallery: "mosaic", testimonials: "cards", faq: "cards", contact: "stacked", trust: "row", zone: "card", cta_quote: "band", availability: "grid" };

function Keywords({ words }: { words: string[] }) {
  return (
    <div className="border-y-4 border-(--pg-text)">
      <p className="mx-auto max-w-7xl px-5 py-3 text-xl font-bold sm:px-8 sm:text-2xl">{words.join(", ")}</p>
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
      <Keywords words={words} />
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
      <TemplateFooter data={data} className="border-0" />
    </div>
  );
}
