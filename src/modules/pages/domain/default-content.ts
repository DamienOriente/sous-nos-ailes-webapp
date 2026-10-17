import { getTemplateOrDefault } from "@/modules/pages/templates/registry";
import { plainToRichText, type Block, type BlockType, type PageContent } from "./page-schema";
import type { ProfessionalSnapshot } from "./render-data";

/**
 * Generates a first draft of a page from the listing itself, so a professional
 * never starts from a blank screen. Deterministic block ids (derived from the
 * block type) keep the seed idempotent and the tests predictable.
 */
export type SnapshotForDefaults = Pick<
  ProfessionalSnapshot,
  "displayName" | "tagline" | "description" | "categoryName" | "city" | "department" | "interventionRadiusKm" | "priceFromCents" | "publicEmail" | "publicPhone" | "website" | "socialLinks" | "yearsExperience" | "eventTypes"
>;

export function defaultBlockFor(type: BlockType, pro: SnapshotForDefaults, id = `blk-${type}`): Block {
  const where = pro.city ? ` à ${pro.city}` : "";
  switch (type) {
    case "hero":
      return {
        id,
        type,
        hidden: false,
        props: {
          title: pro.displayName,
          subtitle: pro.tagline ?? `${pro.categoryName}${where}`,
          kicker: `${pro.categoryName}${where}`,
          cta: { label: "Demander un devis", action: "quote" },
        },
      };
    case "about":
      return {
        id,
        type,
        hidden: false,
        props: {
          heading: "À propos",
          body: plainToRichText(pro.description ?? `${pro.displayName} vous accompagne pour vos évènements${where}.`),
        },
      };
    case "services":
      return { id, type, hidden: false, props: { heading: "Prestations", source: "catalog", items: [] } };
    case "pricing":
      return {
        id,
        type,
        hidden: false,
        props: {
          heading: "Tarifs indicatifs",
          items: pro.priceFromCents ? [{ label: "Prestation standard", priceCents: pro.priceFromCents, unit: "la prestation" }] : [],
          disclaimer: "Chaque évènement est différent : ces tarifs sont indicatifs, le devis est gratuit et personnalisé.",
        },
      };
    case "gallery":
      return { id, type, hidden: false, props: { heading: "En images", images: [] } };
    case "testimonials":
      return { id, type, hidden: false, props: { heading: "Ils nous ont fait confiance", reviewIds: [] } };
    case "faq":
      return {
        id,
        type,
        hidden: false,
        props: {
          heading: "Questions fréquentes",
          items: [
            { question: "Comment se passe la première prise de contact ?", answer: "Vous décrivez votre évènement via le formulaire de demande ; une réponse personnalisée vous est envoyée sous 48 heures." },
            { question: "Vous déplacez-vous ?", answer: `Oui, dans un rayon d'environ ${pro.interventionRadiusKm} km${where}. Au-delà, des frais de déplacement peuvent s'appliquer.` },
          ],
        },
      };
    case "contact":
      return { id, type, hidden: false, props: { heading: "Contact", showEmail: true, showPhone: true, showWebsite: true, buttonLabel: "Envoyer une demande" } };
    case "availability":
      return { id, type, hidden: false, props: { heading: "Disponibilités habituelles", note: "Les disponibilités affichées sont indicatives ; confirmez la date dans votre demande." } };
    case "social": {
      const links = Object.entries(pro.socialLinks ?? {})
        .filter(([k, v]) => ["instagram", "facebook", "tiktok", "youtube", "linkedin", "pinterest", "website"].includes(k) && /^https?:\/\//.test(v))
        .map(([network, url]) => ({ network: network as "instagram", url }));
      return { id, type, hidden: links.length === 0, props: { heading: "Suivez-nous", links } };
    }
    case "cta_quote":
      return { id, type, hidden: false, props: { title: "Parlons de votre évènement", text: "Un devis gratuit, une réponse rapide, aucune obligation.", buttonLabel: "Demander un devis" } };
    case "trust":
      return { id, type, hidden: false, props: { heading: "Confiance" } };
    case "zone":
      return { id, type, hidden: false, props: { heading: "Zone d'intervention", departments: pro.department ? [pro.department] : [] } };
  }
}

export function generateDefaultContent(pro: SnapshotForDefaults, templateKey: string): PageContent {
  const template = getTemplateOrDefault(templateKey);
  return template.defaultSections.map((type) => defaultBlockFor(type, pro));
}

/** When switching template: keep the blocks already written, append the template's default sections that are missing. */
export function mergeContentForTemplate(current: PageContent, templateKey: string, pro: SnapshotForDefaults): PageContent {
  const template = getTemplateOrDefault(templateKey);
  const have = new Set(current.map((b) => b.type));
  const missing = template.defaultSections.filter((t) => !have.has(t)).map((t) => ({ ...defaultBlockFor(t, pro), hidden: true }));
  return [...current, ...missing];
}
