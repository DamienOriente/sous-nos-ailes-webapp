/**
 * Completeness score (0..100) with explainable recommendations. Each criterion
 * has a weight; the recommendation text tells the professional what to do.
 */
export type CompletenessInput = {
  displayName: string | null;
  tagline: string | null;
  description: string | null;
  city: string | null;
  postalCode: string | null;
  priceFromCents: number | null;
  languages: readonly string[];
  eventTypes: readonly string[];
  yearsExperience: number | null;
  publicEmail: string | null;
  publicPhone: string | null;
  website: string | null;
  tradeDetails: Record<string, unknown>;
  servicesCount: number;
  availabilityCount: number;
  verifiedCount: number;
  mediaCount?: number;
  secondaryCategoriesCount?: number;
};

export type Recommendation = { key: string; label: string; weight: number; href?: string };

type Criterion = { key: string; weight: number; label: string; href?: string; met: (i: CompletenessInput) => boolean };

const CRITERIA: readonly Criterion[] = [
  { key: "name", weight: 8, label: "Renseigner un nom commercial", href: "fiche", met: (i) => Boolean(i.displayName && i.displayName.trim().length >= 2) },
  { key: "tagline", weight: 6, label: "Ajouter une accroche courte", href: "fiche", met: (i) => Boolean(i.tagline && i.tagline.trim().length >= 10) },
  { key: "description", weight: 14, label: "Rédiger une description d'au moins 200 caractères", href: "fiche", met: (i) => Boolean(i.description && i.description.trim().length >= 200) },
  { key: "location", weight: 8, label: "Indiquer votre ville et code postal", href: "fiche", met: (i) => Boolean(i.city && i.postalCode) },
  { key: "price", weight: 8, label: "Donner une fourchette tarifaire indicative", href: "fiche", met: (i) => i.priceFromCents !== null && i.priceFromCents > 0 },
  { key: "event_types", weight: 6, label: "Préciser les types d'évènements couverts", href: "fiche", met: (i) => i.eventTypes.length > 0 },
  { key: "languages", weight: 3, label: "Indiquer les langues parlées", href: "fiche", met: (i) => i.languages.length > 0 },
  { key: "experience", weight: 4, label: "Renseigner vos années d'expérience", href: "fiche", met: (i) => i.yearsExperience !== null },
  { key: "contact", weight: 6, label: "Ajouter un e-mail ou un téléphone professionnel", href: "fiche", met: (i) => Boolean(i.publicEmail || i.publicPhone) },
  { key: "website", weight: 2, label: "Ajouter votre site ou vos réseaux", href: "fiche", met: (i) => Boolean(i.website) },
  { key: "trade_details", weight: 10, label: "Compléter le formulaire spécifique à votre métier", href: "fiche", met: (i) => Object.values(i.tradeDetails).filter((v) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)).length >= 2 },
  { key: "services", weight: 12, label: "Décrire au moins une prestation", href: "prestations", met: (i) => i.servicesCount >= 1 },
  { key: "availability", weight: 7, label: "Renseigner vos disponibilités hebdomadaires", href: "disponibilites", met: (i) => i.availabilityCount >= 1 },
  { key: "verification", weight: 6, label: "Transmettre un premier justificatif", href: "verification", met: (i) => i.verifiedCount >= 1 },
];

export const COMPLETENESS_TOTAL = CRITERIA.reduce((s, c) => s + c.weight, 0);

export type CompletenessResult = { score: number; recommendations: Recommendation[]; metKeys: string[] };

export function computeCompleteness(input: CompletenessInput): CompletenessResult {
  let earned = 0;
  const recommendations: Recommendation[] = [];
  const metKeys: string[] = [];
  for (const c of CRITERIA) {
    if (c.met(input)) {
      earned += c.weight;
      metKeys.push(c.key);
    } else {
      recommendations.push({ key: c.key, label: c.label, weight: c.weight, href: c.href });
    }
  }
  recommendations.sort((a, b) => b.weight - a.weight);
  return { score: Math.round((earned / COMPLETENESS_TOTAL) * 100), recommendations, metKeys };
}

/** Minimum score required before a listing can be submitted for review. */
export const SUBMISSION_MIN_SCORE = 40;
