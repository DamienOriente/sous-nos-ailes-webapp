import { env } from "@/lib/env";
import type { Actor } from "@/lib/session";
import { getDraft, type DraftState } from "@/modules/pages/application/page-service";
import type { Completeness } from "@/modules/pages/domain/completeness";
import { richTextToPlain } from "@/modules/pages/domain/page-schema";
import { paletteContrastIssues, resolveTheme } from "@/modules/pages/domain/theme";
import { checkDescription, checkTitle, generateDescription, generateTitle, googlePreview, type MetaCheck, suggestTitles } from "@/modules/seo/domain/meta";

/**
 * Rule-based SEO/GEO assistant. Everything is computed from the draft version
 * and the listing; nothing calls an external service, so every item is marked
 * either "verified" (a fact we checked) or "advice" (a recommendation).
 */
export type SeoItem = { kind: "verified" | "advice"; level: "ok" | "warn" | "error" | "info"; message: string; href?: string };

export type ImageReport = { fileId: string; alt: string; altOk: boolean; sizeBytes: number | null; heavy: boolean; width: number | null; height: number | null; where: string };

export type SeoReport = {
  professionalId: string;
  slug: string;
  publicUrl: string;
  completeness: Completeness;
  title: { current: string | null; effective: string; check: MetaCheck; suggestions: string[] };
  description: { current: string | null; effective: string; check: MetaCheck; suggestion: string };
  preview: { title: string; description: string; url: string };
  images: { items: ImageReport[]; missingAlt: number; heavy: number; total: number };
  local: SeoItem[];
  editorial: SeoItem[];
  accessibility: SeoItem[];
  indexation: { status: "eligible" | "not_indexable" | "platform_closed" | "not_published"; message: string; verifiable: false };
  publishedVersion: DraftState["published"];
  pendingReview: boolean;
};

const HEAVY_BYTES = 600 * 1024;

export async function buildSeoReport(actor: Actor, professionalId: string): Promise<SeoReport> {
  const draft = await getDraft(actor, professionalId);
  const pro = draft.renderData.professional;
  const content = draft.renderData.content;
  const publicUrl = `${env.APP_URL}/pro/${draft.slug}`;

  const effectiveTitle = draft.draft.seoTitle?.trim() || generateTitle(pro);
  const effectiveDescription = draft.draft.seoDescription?.trim() || generateDescription(pro, content);

  // Images: hero, about, gallery, alt text and weight from the files table.
  const metaById = new Map(draft.renderData.images.map((i) => [i.fileId, i]));
  const images: ImageReport[] = [];
  const push = (fileId: string, alt: string, where: string) => {
    const m = metaById.get(fileId);
    images.push({ fileId, alt, altOk: alt.trim().length >= 3, sizeBytes: m?.sizeBytes ?? null, heavy: (m?.sizeBytes ?? 0) > HEAVY_BYTES, width: m?.width ?? null, height: m?.height ?? null, where });
  };
  for (const b of content) {
    if (b.hidden) continue;
    if (b.type === "hero" && b.props.imageFileId) push(b.props.imageFileId, b.props.imageAlt ?? "", "En-tête");
    if (b.type === "about" && b.props.imageFileId) push(b.props.imageFileId, b.props.imageAlt ?? "", "À propos");
    if (b.type === "gallery") b.props.images.forEach((img, i) => push(img.fileId, img.alt, `Galerie · image ${i + 1}`));
  }

  const local: SeoItem[] = [
    pro.city ? { kind: "verified", level: "ok", message: `Ville renseignée : ${pro.city}${pro.postalCode ? ` (${pro.postalCode})` : ""}.` } : { kind: "advice", level: "error", message: "Aucune ville : les recherches locales (« garde d'enfants Toulouse ») ne pourront pas vous trouver.", href: `/app/pro/${professionalId}/fiche` },
    pro.department ? { kind: "verified", level: "ok", message: `Département : ${pro.department}.` } : { kind: "advice", level: "warn", message: "Précisez votre département pour apparaître sur les pages locales de l'annuaire.", href: `/app/pro/${professionalId}/fiche` },
    { kind: "verified", level: "info", message: `Rayon d'intervention déclaré : ${pro.interventionRadiusKm} km.` },
    pro.publicPhone ? { kind: "verified", level: "ok", message: "Téléphone public renseigné (affiché et transmis aux moteurs via les données structurées)." } : { kind: "advice", level: "warn", message: "Ajoutez un téléphone public : il rassure et compte pour le référencement local.", href: `/app/pro/${professionalId}/fiche` },
    pro.publicEmail ? { kind: "verified", level: "ok", message: "E-mail public renseigné." } : { kind: "advice", level: "info", message: "Un e-mail public est facultatif : le formulaire de demande suffit." },
    content.some((b) => b.type === "zone" && !b.hidden) ? { kind: "verified", level: "ok", message: "Section « Zone d'intervention » visible." } : { kind: "advice", level: "warn", message: "Affichez la section « Zone d'intervention » : elle nomme les lieux que vous couvrez.", href: `/app/pro/${professionalId}/page` },
    effectiveTitle.toLowerCase().includes((pro.city ?? "").toLowerCase()) && pro.city ? { kind: "verified", level: "ok", message: "Le titre de la page mentionne votre ville." } : { kind: "advice", level: "warn", message: "Ajoutez votre ville au titre de la page (métier + ville est la requête la plus fréquente)." },
  ];

  const about = content.find((b) => b.type === "about" && !b.hidden);
  const aboutText = about && about.type === "about" ? richTextToPlain(about.props.body) : "";
  const words = aboutText.split(/\s+/).filter(Boolean).length;
  const faq = content.find((b) => b.type === "faq" && !b.hidden);
  const faqCount = faq && faq.type === "faq" ? faq.props.items.length : 0;
  const services = draft.renderData.services.length;
  const editorial: SeoItem[] = [
    words >= 120 ? { kind: "verified", level: "ok", message: `Texte « À propos » : ${words} mots.` } : { kind: "advice", level: words === 0 ? "error" : "warn", message: `Texte « À propos » : ${words} mots. Visez 120 à 300 mots qui décrivent vos prestations, votre méthode et vos lieux d'intervention.`, href: `/app/pro/${professionalId}/page` },
    faqCount >= 3 ? { kind: "verified", level: "ok", message: `${faqCount} questions fréquentes (exposées en données structurées FAQPage).` } : { kind: "advice", level: "info", message: "Trois questions fréquentes ou plus : elles répondent aux requêtes en langage naturel et aux assistants de recherche (GEO).", href: `/app/pro/${professionalId}/page` },
    services > 0 ? { kind: "verified", level: "ok", message: `${services} prestation(s) exposée(s) en données structurées Service.` } : { kind: "advice", level: "warn", message: "Décrivez vos prestations une par une : chaque prestation nommée est une requête potentielle.", href: `/app/pro/${professionalId}/prestations` },
    { kind: "advice", level: "info", message: "Écrivez comme vous parlez à un client : phrases courtes, mots que vos clients utilisent (« baby-sitter mariage », pas « solution de garde »)." },
    { kind: "advice", level: "info", message: "Les moteurs génératifs citent les pages qui donnent des réponses nettes : un prix « à partir de », un rayon en km, une capacité d'accueil." },
    draft.renderData.reviews.length > 0 ? { kind: "verified", level: "ok", message: `${draft.renderData.reviews.length} avis publié(s) : la note agrégée est exposée aux moteurs.` } : { kind: "advice", level: "info", message: "Aucun avis publié : invitez vos clients à laisser un avis après leur évènement (aucun avis ne peut être ajouté manuellement)." },
  ];

  const theme = resolveTheme(draft.renderData.templateKey, draft.renderData.theme);
  const contrast = paletteContrastIssues(theme.palette, theme.accent);
  const accessibility: SeoItem[] = [
    ...(contrast.length === 0 ? [{ kind: "verified", level: "ok", message: "Contrastes texte/fond et boutons conformes AA (clair et sombre)." } as SeoItem] : contrast.map((c): SeoItem => ({ kind: "verified", level: "warn", message: c, href: `/app/pro/${professionalId}/page` }))),
    images.filter((i) => !i.altOk).length === 0 ? { kind: "verified", level: images.length ? "ok" : "info", message: images.length ? "Toutes les images ont une description." : "Aucune image sur la page." } : { kind: "advice", level: "warn", message: `${images.filter((i) => !i.altOk).length} image(s) sans description : décrivez ce qu'elles montrent.`, href: `/app/pro/${professionalId}/page` },
  ];

  const indexation: SeoReport["indexation"] = !draft.published
    ? { status: "not_published", message: "Aucune version publiée : la page n'est pas accessible au public.", verifiable: false }
    : !env.INDEXING_ENABLED
      ? { status: "platform_closed", message: "L'indexation est désactivée au niveau de la plateforme (phase de lancement) : la page est en ligne mais signalée « noindex ».", verifiable: false }
      : !draft.isIndexable || pro.isDemo
        ? { status: "not_indexable", message: pro.isDemo ? "Fiche de démonstration : jamais indexée." : "La page est marquée non indexable.", verifiable: false }
        : { status: "eligible", message: "Éligible à l'indexation : la page est déclarée dans le sitemap et autorisée dans robots.txt. L'indexation effective par les moteurs n'est pas vérifiable depuis la plateforme.", verifiable: false };

  return {
    professionalId,
    slug: draft.slug,
    publicUrl,
    completeness: draft.completeness,
    title: { current: draft.draft.seoTitle, effective: effectiveTitle, check: checkTitle(draft.draft.seoTitle), suggestions: suggestTitles(pro) },
    description: { current: draft.draft.seoDescription, effective: effectiveDescription, check: checkDescription(draft.draft.seoDescription), suggestion: generateDescription(pro, content) },
    preview: googlePreview({ title: effectiveTitle, description: effectiveDescription, url: publicUrl }),
    images: { items: images, missingAlt: images.filter((i) => !i.altOk).length, heavy: images.filter((i) => i.heavy).length, total: images.length },
    local,
    editorial,
    accessibility,
    indexation,
    publishedVersion: draft.published,
    pendingReview: draft.pendingReview,
  };
}
