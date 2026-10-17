import { richTextToPlain, type Block, type PageContent } from "./page-schema";
import type { ProfessionalSnapshot } from "./render-data";

/**
 * Explainable completeness score. Each criterion has a weight and a
 * recommendation; the score is the sum of the satisfied weights (0-100).
 * Pure: the caller passes the listing snapshot and the version content.
 */
export type RecommendationKind =
  | "hero_title"
  | "hero_image"
  | "about_length"
  | "services"
  | "pricing"
  | "gallery"
  | "gallery_alt"
  | "faq"
  | "contact"
  | "zone"
  | "seo_title"
  | "seo_description"
  | "testimonials"
  | "trust"
  | "city"
  | "phone_or_email";

export type Recommendation = {
  kind: RecommendationKind;
  weight: number;
  satisfied: boolean;
  /** Plain-language advice, written for the professional. */
  message: string;
  /** Where to fix it in the builder. */
  target: "page" | "seo" | "listing";
  blockId?: string;
};

export type Completeness = { score: number; recommendations: Recommendation[]; satisfiedCount: number; total: number };

export type CompletenessInput = {
  professional: Pick<ProfessionalSnapshot, "city" | "publicEmail" | "publicPhone" | "verificationLevel" | "reviewCount">;
  content: PageContent;
  seoTitle: string | null | undefined;
  seoDescription: string | null | undefined;
  /** Number of catalogue services (professional_services) available to the "catalog" source. */
  catalogServiceCount: number;
  publishedReviewCount: number;
};

function visible<T extends Block["type"]>(content: PageContent, type: T): Extract<Block, { type: T }> | undefined {
  return content.find((b): b is Extract<Block, { type: T }> => b.type === type && !b.hidden);
}

export function computeCompleteness(input: CompletenessInput): Completeness {
  const { content } = input;
  const hero = visible(content, "hero");
  const about = visible(content, "about");
  const services = visible(content, "services");
  const pricing = visible(content, "pricing");
  const gallery = visible(content, "gallery");
  const faq = visible(content, "faq");
  const contact = visible(content, "contact");
  const zone = visible(content, "zone");
  const testimonials = visible(content, "testimonials");
  const trust = visible(content, "trust");

  const aboutLength = about ? richTextToPlain(about.props.body).length : 0;
  const servicesOk = Boolean(services && (services.props.source === "catalog" ? input.catalogServiceCount > 0 : services.props.items.length > 0));
  const galleryCount = gallery?.props.images.length ?? 0;
  const missingAlt = gallery ? gallery.props.images.filter((i) => i.alt.trim().length < 3).length : 0;

  const recs: Recommendation[] = [
    { kind: "hero_title", weight: 8, satisfied: Boolean(hero && hero.props.title.trim().length >= 3), message: "Donnez un titre clair à votre en-tête : votre nom ou celui de votre activité.", target: "page", blockId: hero?.id },
    { kind: "hero_image", weight: 10, satisfied: Boolean(hero?.props.imageFileId), message: "Ajoutez une image principale : c'est la première chose que voient les organisateurs.", target: "page", blockId: hero?.id },
    { kind: "about_length", weight: 10, satisfied: aboutLength >= 200, message: "Rédigez au moins 200 caractères dans « À propos » : votre parcours, votre approche, ce qui vous distingue.", target: "page", blockId: about?.id },
    { kind: "services", weight: 12, satisfied: servicesOk, message: "Décrivez au moins une prestation (depuis votre catalogue ou en texte libre).", target: "page", blockId: services?.id },
    { kind: "pricing", weight: 6, satisfied: Boolean(pricing && pricing.props.items.length > 0), message: "Indiquez un tarif « à partir de » : les fiches avec prix reçoivent plus de demandes qualifiées.", target: "page", blockId: pricing?.id },
    { kind: "gallery", weight: 10, satisfied: galleryCount >= 3, message: "Publiez au moins 3 photos de vos réalisations.", target: "page", blockId: gallery?.id },
    { kind: "gallery_alt", weight: 4, satisfied: galleryCount > 0 && missingAlt === 0, message: missingAlt > 0 ? `${missingAlt} image(s) sans description : décrivez chaque photo en une phrase (accessibilité et référencement).` : "Décrivez chaque photo en une phrase (accessibilité et référencement).", target: "page", blockId: gallery?.id },
    { kind: "faq", weight: 5, satisfied: Boolean(faq && faq.props.items.length >= 2), message: "Répondez à au moins deux questions fréquentes.", target: "page", blockId: faq?.id },
    { kind: "contact", weight: 6, satisfied: Boolean(contact), message: "Affichez une section Contact avec le bouton de demande.", target: "page", blockId: contact?.id },
    { kind: "zone", weight: 5, satisfied: Boolean(zone), message: "Précisez votre zone d'intervention.", target: "page", blockId: zone?.id },
    { kind: "city", weight: 5, satisfied: Boolean(input.professional.city), message: "Renseignez votre ville dans votre fiche : indispensable pour apparaître dans les recherches locales.", target: "listing" },
    { kind: "phone_or_email", weight: 4, satisfied: Boolean(input.professional.publicEmail || input.professional.publicPhone), message: "Ajoutez au moins un moyen de contact public (e-mail ou téléphone).", target: "listing" },
    { kind: "seo_title", weight: 5, satisfied: Boolean(input.seoTitle && input.seoTitle.length >= 20 && input.seoTitle.length <= 65), message: "Rédigez un titre de page entre 20 et 65 caractères (métier + ville).", target: "seo" },
    { kind: "seo_description", weight: 5, satisfied: Boolean(input.seoDescription && input.seoDescription.length >= 70 && input.seoDescription.length <= 160), message: "Rédigez une description entre 70 et 160 caractères.", target: "seo" },
    { kind: "testimonials", weight: 3, satisfied: Boolean(testimonials && input.publishedReviewCount > 0), message: input.publishedReviewCount > 0 ? "Affichez vos avis publiés." : "Les avis apparaîtront quand un client aura laissé un avis vérifié (aucun avis ne peut être saisi à la main).", target: "page", blockId: testimonials?.id },
    { kind: "trust", weight: 2, satisfied: Boolean(trust && input.professional.verificationLevel > 0), message: input.professional.verificationLevel > 0 ? "Affichez la section Confiance pour montrer vos vérifications." : "Déposez vos justificatifs (SIRENE, assurance) pour obtenir un niveau de vérification.", target: input.professional.verificationLevel > 0 ? "page" : "listing", blockId: trust?.id },
  ];

  const total = recs.reduce((s, r) => s + r.weight, 0);
  const got = recs.filter((r) => r.satisfied).reduce((s, r) => s + r.weight, 0);
  return { score: Math.round((got / total) * 100), recommendations: recs, satisfiedCount: recs.filter((r) => r.satisfied).length, total: recs.length };
}
