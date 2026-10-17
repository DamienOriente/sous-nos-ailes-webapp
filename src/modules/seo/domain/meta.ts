import type { PageRenderData, ProfessionalSnapshot } from "@/modules/pages/domain/render-data";
import { richTextToPlain, type PageContent } from "@/modules/pages/domain/page-schema";

/**
 * Rule-based SEO helpers (no external service). Everything here is pure and
 * unit-tested: title/description generation, Google-like preview truncation,
 * JSON-LD graphs. The professional stays in control: these are suggestions.
 */
export const TITLE_MAX = 65;
export const TITLE_MIN = 20;
export const DESCRIPTION_MAX = 160;
export const DESCRIPTION_MIN = 70;
const SITE_NAME = "Sous Nos Ailes";

type TitleInput = Pick<ProfessionalSnapshot, "displayName" | "categoryName" | "city" | "department" | "tagline">;

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
}

/** "Marie Delcourt – Garde d'enfants évènementielle à Toulouse" trimmed to fit. */
export function generateTitle(pro: TitleInput): string {
  const where = pro.city ? ` à ${pro.city}` : "";
  const candidates = [`${pro.displayName} – ${pro.categoryName}${where}`, `${pro.displayName} – ${pro.categoryName}`, `${pro.displayName}${where}`, pro.displayName];
  return candidates.find((c) => c.length <= TITLE_MAX) ?? truncateAtWord(pro.displayName, TITLE_MAX);
}

/** Several alternatives so the professional can pick a tone. */
export function suggestTitles(pro: TitleInput): string[] {
  const where = pro.city ? ` à ${pro.city}` : "";
  const dept = pro.department ? ` (${pro.department})` : "";
  const list = [
    `${pro.displayName} – ${pro.categoryName}${where}`,
    `${pro.categoryName}${where} – ${pro.displayName}`,
    `${pro.displayName} | ${pro.categoryName}${where}${dept}`,
    pro.tagline ? `${pro.displayName} – ${pro.tagline}` : null,
  ].filter((t): t is string => Boolean(t));
  return Array.from(new Set(list.map((t) => (t.length <= TITLE_MAX ? t : truncateAtWord(t, TITLE_MAX)))));
}

export function generateDescription(pro: TitleInput & Pick<ProfessionalSnapshot, "description" | "eventTypes" | "yearsExperience">, content?: PageContent): string {
  const about = content?.find((b) => b.type === "about" && !b.hidden);
  const aboutText = about && about.type === "about" ? richTextToPlain(about.props.body) : "";
  const source = pro.tagline && pro.tagline.length >= DESCRIPTION_MIN ? pro.tagline : aboutText || pro.description || pro.tagline || "";
  const where = pro.city ? ` à ${pro.city}` : "";
  const years = pro.yearsExperience && pro.yearsExperience >= 2 ? ` ${pro.yearsExperience} ans d'expérience.` : "";
  const events = pro.eventTypes.length > 0 ? ` Mariages, ${pro.eventTypes.slice(0, 2).join(", ")}…` : "";
  let text = source.replace(/\s+/g, " ").trim();
  if (text.length < DESCRIPTION_MIN) {
    text = `${pro.displayName}, ${pro.categoryName.toLowerCase()}${where}.${years}${events} ${text}`.replace(/\s+/g, " ").trim();
  }
  if (text.length < DESCRIPTION_MIN) text = `${text} Devis gratuit et réponse rapide via ${SITE_NAME}.`.trim();
  return truncateAtWord(text, DESCRIPTION_MAX);
}

export type MetaCheck = { ok: boolean; level: "ok" | "warn" | "error"; message: string };

export function checkTitle(title: string | null | undefined): MetaCheck {
  const t = (title ?? "").trim();
  if (!t) return { ok: false, level: "error", message: "Aucun titre défini : le titre généré automatiquement sera utilisé." };
  if (t.length < TITLE_MIN) return { ok: false, level: "warn", message: `Titre court (${t.length} caractères) : visez entre ${TITLE_MIN} et ${TITLE_MAX}.` };
  if (t.length > TITLE_MAX) return { ok: false, level: "warn", message: `Titre long (${t.length} caractères) : il sera coupé dans les résultats de recherche.` };
  return { ok: true, level: "ok", message: `Longueur du titre correcte (${t.length} caractères).` };
}

export function checkDescription(description: string | null | undefined): MetaCheck {
  const d = (description ?? "").trim();
  if (!d) return { ok: false, level: "error", message: "Aucune description : une description générée depuis votre fiche sera utilisée." };
  if (d.length < DESCRIPTION_MIN) return { ok: false, level: "warn", message: `Description courte (${d.length} caractères) : visez entre ${DESCRIPTION_MIN} et ${DESCRIPTION_MAX}.` };
  if (d.length > DESCRIPTION_MAX) return { ok: false, level: "warn", message: `Description longue (${d.length} caractères) : elle sera coupée.` };
  return { ok: true, level: "ok", message: `Longueur de la description correcte (${d.length} caractères).` };
}

/** What a search engine would most likely display (indicative, lengths are approximations). */
export function googlePreview(input: { title: string; description: string; url: string }): { title: string; description: string; url: string } {
  return { title: truncateAtWord(input.title, 60), description: truncateAtWord(input.description, 158), url: input.url };
}

// ── JSON-LD ─────────────────────────────────────────────────────────────────
const CATEGORY_SCHEMA_TYPE: Record<string, string> = {
  "domaine-reception": "EventVenue",
  "salle-evenementielle": "EventVenue",
  hebergement: "LodgingBusiness",
  traiteur: "FoodEstablishment",
  patissier: "Bakery",
  photographe: "ProfessionalService",
  videaste: "ProfessionalService",
  "wedding-planner": "ProfessionalService",
  transport: "LocalBusiness",
};

export type JsonLd = Record<string, unknown>;

export function buildJsonLd(data: PageRenderData, input: { url: string; siteUrl: string; title: string; description: string; imageUrl?: string | null }): JsonLd[] {
  const pro = data.professional;
  const type = CATEGORY_SCHEMA_TYPE[pro.categorySlug] ?? "LocalBusiness";
  const sameAs = Object.values(pro.socialLinks ?? {}).filter((u) => /^https?:\/\//.test(u));
  const business: JsonLd = {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${input.url}#business`,
    name: pro.displayName,
    description: input.description,
    url: input.url,
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    ...(pro.publicPhone ? { telephone: pro.publicPhone } : {}),
    ...(pro.publicEmail ? { email: pro.publicEmail } : {}),
    ...(pro.city
      ? { address: { "@type": "PostalAddress", addressLocality: pro.city, ...(pro.postalCode ? { postalCode: pro.postalCode } : {}), ...(pro.region ? { addressRegion: pro.region } : {}), addressCountry: "FR" } }
      : {}),
    ...(pro.city ? { areaServed: { "@type": "GeoCircle", geoMidpoint: { "@type": "Place", name: pro.city }, geoRadius: pro.interventionRadiusKm * 1000 } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(pro.priceFromCents ? { priceRange: `à partir de ${Math.round(pro.priceFromCents / 100)} €` } : {}),
    // AggregateRating only when there are published reviews: no invented ratings.
    ...(data.reviews.length > 0 && pro.averageRating
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(pro.averageRating.toFixed(1)), reviewCount: data.reviews.length, bestRating: 5, worstRating: 1 } }
      : {}),
  };

  const services = data.services.map(
    (s): JsonLd => ({
      "@context": "https://schema.org",
      "@type": "Service",
      name: s.name,
      ...(s.description ? { description: s.description } : {}),
      provider: { "@id": `${input.url}#business` },
      serviceType: pro.categoryName,
      ...(s.priceCents ? { offers: { "@type": "Offer", price: (s.priceCents / 100).toFixed(2), priceCurrency: "EUR", priceSpecification: { "@type": "PriceSpecification", minPrice: (s.priceCents / 100).toFixed(2), priceCurrency: "EUR" } } } : {}),
    }),
  );

  const breadcrumb: JsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: input.siteUrl },
      { "@type": "ListItem", position: 2, name: "Annuaire", item: `${input.siteUrl}/annuaire` },
      { "@type": "ListItem", position: 3, name: pro.categoryName, item: `${input.siteUrl}/annuaire/${pro.categorySlug}` },
      { "@type": "ListItem", position: 4, name: pro.displayName, item: input.url },
    ],
  };

  const faq = data.content.find((b) => b.type === "faq" && !b.hidden);
  const faqLd: JsonLd[] =
    faq && faq.type === "faq" && faq.props.items.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.props.items.map((it) => ({ "@type": "Question", name: it.question, acceptedAnswer: { "@type": "Answer", text: it.answer } })),
          },
        ]
      : [];

  return [business, ...services, breadcrumb, ...faqLd];
}

/** JSON-LD is embedded in a <script type="application/ld+json">; escape "<" so a value can never close the tag. */
export function serializeJsonLd(items: JsonLd[]): string {
  return JSON.stringify(items.length === 1 ? items[0] : items).replace(/</g, "\\u003c");
}
