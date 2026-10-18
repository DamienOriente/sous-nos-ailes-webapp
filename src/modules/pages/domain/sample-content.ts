import type { PhotoTheme } from "@/modules/media/demo-photos";
import { getTemplateOrDefault } from "@/modules/pages/templates/registry";
import { defaultBlockFor } from "./default-content";
import { plainToRichText, type Block, type PageContent } from "./page-schema";
import type { PageRenderData, ProfessionalSnapshot } from "./render-data";
import { sampleFileIdForPhoto, samplePhotosFor } from "./sample-photos";

/**
 * Representative, clearly fictitious content used by the public template
 * gallery and the builder's template picker. No file ids (placeholders are
 * drawn in the template's palette) unless `withSamplePhotos` adds catalogue
 * photographs encoded as sample ids; no reviews except explicitly labelled
 * sample ones in preview mode.
 */
type Persona = {
  snapshot: ProfessionalSnapshot;
  /** Demo photo themes, in order of preference (hero first). */
  photos: PhotoTheme[];
  about: string;
  services: PageRenderData["services"];
  faq: Array<{ question: string; answer: string }>;
  pricing: Array<{ label: string; priceCents: number; unit?: string; note?: string }>;
};

const base = (over: Partial<ProfessionalSnapshot>): ProfessionalSnapshot => ({
  id: "00000000-0000-0000-0000-000000000000",
  slug: "exemple",
  displayName: "Exemple",
  tagline: null,
  description: null,
  categoryName: "Prestataire",
  categorySlug: "generic",
  categoryGroup: "Organisation",
  city: "Toulouse",
  postalCode: "31000",
  department: "31",
  region: "Occitanie",
  interventionRadiusKm: 60,
  priceFromCents: 35000,
  priceToCents: null,
  priceUnit: "la prestation",
  languages: ["fr", "en"],
  eventTypes: ["mariage", "anniversaire", "séminaire"],
  yearsExperience: 8,
  publicEmail: "contact@exemple.test",
  publicPhone: "05 61 00 00 00",
  website: "https://exemple.test",
  socialLinks: { instagram: "https://instagram.com/exemple" },
  verificationLevel: 2,
  averageRating: 4.8,
  reviewCount: 2,
  isDemo: true,
  acceptsChildrenServices: false,
  status: "published",
  publishedAt: null,
  ...over,
});

const PERSONAS: Record<string, Persona> = {
  childcare: {
    photos: ["kids", "family", "balloons"],
    snapshot: base({ displayName: "Les Petites Ailes", tagline: "Garde d'enfants pour mariages : deux animatrices, quinze enfants au maximum", categoryName: "Garde d'enfants évènementielle", categorySlug: "garde-enfants-evenementielle", categoryGroup: "Enfants", acceptsChildrenServices: true, priceFromCents: 42000, priceUnit: "la soirée" }),
    about: "Depuis huit ans, nous installons un espace enfants complet lors des mariages et réceptions : coin calme pour les tout-petits, ateliers créatifs pour les plus grands, veilleuses et histoires du soir.\n\nChaque animatrice est diplômée petite enfance et formée aux premiers secours. Nous prenons le relais dès l'arrivée des familles et chaque enfant est remis à un adulte autorisé par les parents.",
    services: [
      { id: "s1", name: "Espace enfants mariage", description: "Encadrement complet de l'apéritif au gâteau, jeux, ateliers et coin sieste.", priceCents: 42000, priceUnit: "la soirée", durationMinutes: 360, minAge: 1, maxAge: 12, capacity: 15 },
      { id: "s2", name: "Garde pendant la cérémonie", description: "Deux heures de calme pour que chacun profite du moment.", priceCents: 14000, priceUnit: "les 2 h", durationMinutes: 120, minAge: 0, maxAge: 10, capacity: 8 },
      { id: "s3", name: "Brunch du lendemain", description: "Activités douces et surveillance pendant le brunch.", priceCents: 18000, priceUnit: "la matinée", durationMinutes: 180, minAge: 1, maxAge: 12, capacity: 12 },
    ],
    faq: [
      { question: "Combien d'animatrices pour combien d'enfants ?", answer: "Une animatrice pour 6 enfants de plus de 3 ans, une pour 3 enfants en dessous. Nous ajustons l'équipe à la liste que vous nous confiez." },
      { question: "Que faut-il prévoir sur place ?", answer: "Une pièce ou un coin abrité, quelques chaises et un accès à un point d'eau. Nous apportons tout le reste : tapis, jeux, matériel créatif, veilleuses." },
      { question: "Gérez-vous les allergies et traitements ?", answer: "Oui. Les informations transmises par les parents via la plateforme restent confidentielles et ne sont consultées que par l'équipe présente le jour J." },
    ],
    pricing: [
      { label: "Espace enfants complet", priceCents: 42000, unit: "la soirée", note: "jusqu'à 15 enfants, 2 animatrices" },
      { label: "Garde cérémonie", priceCents: 14000, unit: "les 2 heures" },
    ],
  },
  wedding: {
    photos: ["wedding", "flowers", "reception"],
    snapshot: base({ displayName: "Camille Ferrand", tagline: "Wedding planner à Toulouse : dix couples par an, budget suivi ligne par ligne", categoryName: "Wedding planner", categorySlug: "wedding-planner", priceFromCents: 180000, priceUnit: "le mariage" }),
    about: "J'accompagne une dizaine de couples par an, pas plus, pour garder le temps de connaître chacun. De la recherche du lieu au dernier verre, je coordonne les prestataires, le budget et le planning du jour.\n\nJe donne mon avis sur chaque choix, je suis le budget chaque semaine et je reste jusqu'au départ du dernier prestataire.",
    services: [
      { id: "s1", name: "Organisation complète", description: "De la première rencontre au jour J : conception, prestataires, budget, coordination.", priceCents: 480000, priceUnit: "le mariage", durationMinutes: null, minAge: null, maxAge: null, capacity: null },
      { id: "s2", name: "Coordination du jour J", description: "Vous avez tout préparé ; je m'assure que tout se déroule comme prévu.", priceCents: 180000, priceUnit: "la journée", durationMinutes: null, minAge: null, maxAge: null, capacity: null },
      { id: "s3", name: "Conseil et planning", description: "Trois rendez-vous pour cadrer le budget, le rétroplanning et les prestataires.", priceCents: 90000, priceUnit: "le forfait", durationMinutes: null, minAge: null, maxAge: null, capacity: null },
    ],
    faq: [
      { question: "Travaillez-vous avec vos propres prestataires ?", answer: "Je propose des professionnels que je connais, mais vous restez libres de vos choix. Je ne touche aucune commission." },
      { question: "À quel moment vous contacter ?", answer: "Idéalement 12 à 18 mois avant la date, dès que le lieu est en réflexion. Une coordination du jour J peut se décider trois mois avant." },
    ],
    pricing: [
      { label: "Coordination du jour J", priceCents: 180000, unit: "la journée" },
      { label: "Organisation complète", priceCents: 480000, unit: "le mariage", note: "selon le nombre d'invités" },
    ],
  },
  venue: {
    photos: ["venue", "reception", "landscape", "terrace"],
    snapshot: base({ displayName: "Domaine de Saint-Arnaud", tagline: "Bastide à Lavaur : orangerie de 180 places, 12 chambres, parc de platanes", categoryName: "Domaine de réception", categorySlug: "domaine-reception", categoryGroup: "Lieux", city: "Lavaur", postalCode: "81500", department: "81", priceFromCents: 650000, priceUnit: "le week-end", interventionRadiusKm: 0 }),
    about: "Le domaine accueille jusqu'à 180 convives dans l'orangerie et sous les platanes du parc. Les 12 chambres de la bastide sont réservées à vos proches pour le week-end.\n\nNous laissons les traiteurs libres de travailler dans la cuisine professionnelle attenante et mettons à disposition tables, chaises et mobilier de cocktail.",
    services: [
      { id: "s1", name: "Location week-end", description: "Du vendredi 14 h au dimanche 18 h, orangerie, parc et bastide.", priceCents: 650000, priceUnit: "le week-end", durationMinutes: null, minAge: null, maxAge: null, capacity: 180 },
      { id: "s2", name: "Journée séminaire", description: "Salle plénière, deux salles de sous-commission, pauses et déjeuner sous les arbres.", priceCents: 280000, priceUnit: "la journée", durationMinutes: null, minAge: null, maxAge: null, capacity: 80 },
    ],
    faq: [
      { question: "Jusqu'à quelle heure la musique est-elle autorisée ?", answer: "Jusqu'à 4 h en intérieur, 1 h en extérieur, par respect pour le voisinage." },
      { question: "Faut-il choisir un traiteur de votre liste ?", answer: "Non, le traiteur est libre. Nous demandons simplement une visite technique en amont." },
    ],
    pricing: [{ label: "Location week-end complet", priceCents: 650000, unit: "le week-end", note: "hébergement de 24 personnes inclus" }],
  },
  caterer: {
    photos: ["food", "reception", "toast"],
    snapshot: base({ displayName: "Maison Rossi", tagline: "Traiteur à Albi : cuisine de saison avec les producteurs du Tarn", categoryName: "Traiteur", categorySlug: "traiteur", categoryGroup: "Restauration", city: "Albi", postalCode: "81000", department: "81", priceFromCents: 7500, priceUnit: "par personne" }),
    about: "Julien et son équipe cuisinent sur place, avec les producteurs du Tarn. Menus écrits avec vous, servis à l'assiette ou en buffets.\n\nNous gérons les régimes et allergies à partir de la liste que vous nous confiez, sans plat « à part » : chacun mange la même belle chose.",
    services: [
      { id: "s1", name: "Cocktail dînatoire", description: "18 pièces par personne, bar à huîtres en option.", priceCents: 5800, priceUnit: "par personne", durationMinutes: null, minAge: null, maxAge: null, capacity: 300 },
      { id: "s2", name: "Dîner à l'assiette", description: "Entrée, plat, fromage, dessert, service compris.", priceCents: 9800, priceUnit: "par personne", durationMinutes: null, minAge: null, maxAge: null, capacity: 220 },
      { id: "s3", name: "Brunch du lendemain", description: "Viennoiseries maison, œufs, charcuteries et fruits.", priceCents: 3200, priceUnit: "par personne", durationMinutes: null, minAge: null, maxAge: null, capacity: 150 },
    ],
    faq: [
      { question: "Faites-vous goûter avant ?", answer: "Oui, une dégustation du menu pressenti est proposée à partir de 80 convives." },
      { question: "Proposez-vous des menus enfants ?", answer: "Oui, un menu adapté à 22 € par enfant de moins de 12 ans." },
    ],
    pricing: [
      { label: "Cocktail dînatoire", priceCents: 5800, unit: "par personne" },
      { label: "Dîner à l'assiette", priceCents: 9800, unit: "par personne" },
    ],
  },
  photo: {
    photos: ["wedding", "photo", "family"],
    snapshot: base({ displayName: "Inès Garnier", tagline: "Reportage de mariage en lumière naturelle, galerie privée sous quatre semaines", categoryName: "Photographe", categorySlug: "photographe", categoryGroup: "Image & son", priceFromCents: 190000, priceUnit: "le reportage" }),
    about: "Je photographie des mariages depuis dix ans, en lumière naturelle, sans mise en scène forcée. Mon travail : être là au bon moment et disparaître le reste du temps.\n\nVous recevez une galerie privée sous quatre semaines et un album imprimé en Italie.",
    services: [
      { id: "s1", name: "Reportage journée complète", description: "Des préparatifs à l'ouverture du bal, 600 photos retouchées.", priceCents: 240000, priceUnit: "la journée", durationMinutes: 720, minAge: null, maxAge: null, capacity: null },
      { id: "s2", name: "Cérémonie et cocktail", description: "Cinq heures de présence, 300 photos.", priceCents: 150000, priceUnit: "la demi-journée", durationMinutes: 300, minAge: null, maxAge: null, capacity: null },
    ],
    faq: [
      { question: "Combien de temps pour recevoir les photos ?", answer: "Une sélection sous une semaine, la galerie complète sous quatre semaines." },
      { question: "Travaillez-vous en duo ?", answer: "Un second photographe est possible pour les mariages de plus de 120 invités." },
    ],
    pricing: [{ label: "Reportage journée", priceCents: 240000, unit: "la journée", note: "album 30 pages inclus" }],
  },
  dj: {
    photos: ["dj", "confetti", "toast"],
    snapshot: base({ displayName: "Théo Lambert", tagline: "DJ de mariage à Montauban : sono et lumières comprises, playlist construite avec vous", categoryName: "DJ", categorySlug: "dj", categoryGroup: "Image & son", city: "Montauban", postalCode: "82000", department: "82", priceFromCents: 95000, priceUnit: "la soirée" }),
    about: "Dix ans de soirées, du cocktail jazzy aux dernières heures électro. Je construis la playlist avec vous : vos incontournables d'un côté, vos interdits de l'autre.\n\nSonorisation et éclairage sont compris ; je m'adapte à la salle lors d'une visite technique.",
    services: [
      { id: "s1", name: "Soirée complète", description: "Du cocktail à la fin de soirée, sono et lumières incluses.", priceCents: 120000, priceUnit: "la soirée", durationMinutes: 480, minAge: null, maxAge: null, capacity: null },
      { id: "s2", name: "Cocktail et dîner", description: "Ambiance musicale discrète, micro HF pour les discours.", priceCents: 60000, priceUnit: "le forfait", durationMinutes: 240, minAge: null, maxAge: null, capacity: null },
      { id: "s3", name: "Cérémonie laïque", description: "Enceintes sur batterie, micro pour l'officiant, musiques d'entrée et de sortie.", priceCents: 35000, priceUnit: "le forfait", durationMinutes: 90, minAge: null, maxAge: null, capacity: null },
    ],
    faq: [
      { question: "Prenez-vous les demandes des invités ?", answer: "Oui, dans la limite de ce que nous avons défini ensemble." },
      { question: "Jusqu'à quelle heure ?", answer: "Jusqu'à 4 h ; au-delà, un supplément horaire s'applique." },
    ],
    pricing: [{ label: "Soirée complète", priceCents: 120000, unit: "la soirée" }],
  },
  beauty: {
    photos: ["beauty", "wedding", "flowers"],
    snapshot: base({ displayName: "Studio Lila", tagline: "Maquillage et coiffure de mariée à domicile, essai de deux heures compris", categoryName: "Maquilleur", categorySlug: "maquilleur", categoryGroup: "Beauté", priceFromCents: 18000, priceUnit: "la mariée" }),
    about: "Un essai en studio, puis le jour J à domicile ou sur le lieu. Je travaille des teints lumineux et naturels, qui tiennent aux larmes comme à la chaleur.",
    services: [
      { id: "s1", name: "Mariée : essai + jour J", description: "Essai de 2 h, maquillage et coiffure le matin du mariage.", priceCents: 32000, priceUnit: "le forfait", durationMinutes: 180, minAge: null, maxAge: null, capacity: null },
      { id: "s2", name: "Invitée", description: "Maquillage ou coiffure, 45 minutes.", priceCents: 6500, priceUnit: "par personne", durationMinutes: 45, minAge: null, maxAge: null, capacity: null },
    ],
    faq: [
      { question: "Vous déplacez-vous ?", answer: "Oui, dans un rayon de 60 km autour de Toulouse, frais inclus jusqu'à 30 km." },
      { question: "L'essai est-il obligatoire ?", answer: "Il est compris dans le forfait mariée et vivement conseillé : c'est là que l'on règle la tenue et les couleurs." },
      { question: "Combien de temps le matin du mariage ?", answer: "Environ 1 h 30 pour la mariée, 45 minutes par invitée ; nous fixons l'ordre de passage ensemble." },
    ],
    pricing: [{ label: "Forfait mariée", priceCents: 32000, unit: "le forfait" }],
  },
  music: {
    photos: ["seminar", "dj", "wedding"],
    snapshot: base({ displayName: "Trio Belvédère", tagline: "Trio contrebasse, guitare et voix pour cérémonies et cocktails", categoryName: "Musicien", categorySlug: "musicien", categoryGroup: "Image & son", priceFromCents: 90000, priceUnit: "le set" }),
    about: "Trois musiciens, une contrebasse, une guitare et une voix. Nous jouons acoustique pour les cérémonies et amplifié pour les cocktails ; répertoire adapté à chaque moment.",
    services: [
      { id: "s1", name: "Cérémonie laïque", description: "Entrée, échange des vœux, sortie : trois morceaux choisis avec vous.", priceCents: 90000, priceUnit: "le set", durationMinutes: 60, minAge: null, maxAge: null, capacity: null },
      { id: "s2", name: "Cocktail 2 h", description: "Deux sets de 45 minutes.", priceCents: 140000, priceUnit: "le forfait", durationMinutes: 120, minAge: null, maxAge: null, capacity: null },
    ],
    faq: [
      { question: "Avez-vous besoin d'électricité ?", answer: "Pour la cérémonie non ; pour le cocktail une prise 16 A suffit." },
      { question: "Pouvez-vous jouer un morceau précis ?", answer: "Oui, envoyez-le nous un mois avant : nous l'arrangeons pour le trio." },
      { question: "Jouez-vous en extérieur ?", answer: "Oui, à l'abri du soleil direct et de la pluie pour les instruments." },
    ],
    pricing: [{ label: "Cérémonie", priceCents: 90000, unit: "le set" }],
  },
  travel: {
    photos: ["car", "landscape", "wedding"],
    snapshot: base({ displayName: "Les Navettes du Pastel", tagline: "Minibus 20 places et autocars 50 places avec chauffeur, retours jusqu'à 5 h", categoryName: "Transport", categorySlug: "transport", categoryGroup: "Logistique", priceFromCents: 45000, priceUnit: "la navette" }),
    about: "Minibus de 20 places et autocars de 50, chauffeurs en tenue, itinéraires préparés avec vous. Nous assurons aussi les retours de fin de soirée en plusieurs rotations.",
    services: [
      { id: "s1", name: "Navette aller-retour", description: "Un minibus 20 places, deux rotations.", priceCents: 45000, priceUnit: "la navette", durationMinutes: null, minAge: null, maxAge: null, capacity: 20 },
      { id: "s2", name: "Autocar 50 places", description: "Journée complète avec chauffeur.", priceCents: 95000, priceUnit: "la journée", durationMinutes: null, minAge: null, maxAge: null, capacity: 50 },
    ],
    faq: [
      { question: "Jusqu'à quelle heure assurez-vous les retours ?", answer: "Jusqu'à 5 h du matin, en rotations de 30 minutes." },
      { question: "Fournissez-vous des sièges enfants ?", answer: "Oui, précisez les âges dans votre demande." },
      { question: "Les chauffeurs connaissent-ils le lieu ?", answer: "Un repérage est fait la semaine précédente pour les domaines isolés." },
    ],
    pricing: [{ label: "Navette 20 places", priceCents: 45000, unit: "la navette" }],
  },
};

const TEMPLATE_PERSONA: Record<string, keyof typeof PERSONAS> = {
  "nid-douillet": "childcare",
  "ronde-enfantine": "childcare",
  "sauge-elegante": "wedding",
  "minimal-ivoire": "beauty",
  confettis: "dj",
  "atelier-creatif": "wedding",
  "editorial-luxe": "wedding",
  "boheme-lin": "wedding",
  "champetre-pierre": "venue",
  "panorama-photo": "photo",
  "corporate-net": "venue",
  "moderne-grille": "dj",
  "table-gourmande": "caterer",
  "poudre-rose": "beauty",
  "galerie-noire": "photo",
  argentique: "photo",
  "nuit-electrique": "dj",
  "scene-ouverte": "music",
  "velours-spectacle": "music",
  "jardin-fleuri": "beauty",
  "nature-foret": "venue",
  "lumiere-studio": "beauty",
  "terrasse-azur": "caterer",
  "carnet-voyage": "travel",
};

export function sampleContentFor(templateKey: string, persona: Persona): PageContent {
  const template = getTemplateOrDefault(templateKey);
  const pro = persona.snapshot;
  return template.defaultSections.map((type): Block => {
    const b = defaultBlockFor(type, pro, `sample-${type}`);
    switch (b.type) {
      case "about":
        return { ...b, props: { ...b.props, body: plainToRichText(persona.about) } };
      case "faq":
        return { ...b, props: { ...b.props, items: persona.faq } };
      case "pricing":
        return { ...b, props: { ...b.props, items: persona.pricing } };
      case "gallery":
        return { ...b, props: { ...b.props, images: [] } };
      default:
        return b;
    }
  });
}

/** Render data for the gallery/picker: fictitious persona matching the template, sample reviews flagged as such. */
export function sampleRenderData(templateKey: string, paletteKey?: string): PageRenderData {
  const template = getTemplateOrDefault(templateKey);
  const persona = PERSONAS[TEMPLATE_PERSONA[template.key] ?? "wedding"] ?? (PERSONAS.wedding as Persona);
  const content = sampleContentFor(template.key, persona);
  return {
    professional: persona.snapshot,
    templateKey: template.key,
    theme: { palette: paletteKey ?? template.palettes[0]?.key },
    content,
    services: persona.services,
    reviews: [
      { id: "sample-review-1", authorName: "Exemple d'avis", rating: 5, title: "Avis fictif de démonstration", body: "Ceci est un exemple : sur une vraie page, seuls les avis vérifiés laissés par des clients apparaissent ici.", replyBody: null, createdAt: "2026-05-02T10:00:00.000Z" },
      { id: "sample-review-2", authorName: "Exemple d'avis", rating: 4, title: null, body: "Un second exemple pour montrer la mise en page des avis.", replyBody: null, createdAt: "2026-04-11T10:00:00.000Z" },
    ],
    availability: [
      { weekday: 4, startMinute: 14 * 60, endMinute: 23 * 60 },
      { weekday: 5, startMinute: 10 * 60, endMinute: 24 * 60 - 1 },
      { weekday: 6, startMinute: 10 * 60, endMinute: 18 * 60 },
    ],
    verifications: [
      { kind: "business_registration_checked", status: "verified", statement: "Exemple", reviewedAt: null },
      { kind: "insurance_verified", status: "verified", statement: "Exemple", reviewedAt: null },
    ],
    images: [],
    seoTitle: null,
    seoDescription: null,
  };
}

/** Legacy helper kept for callers that only need the layout: palette placeholders without photos. */
export function withSampleGallery(content: PageContent, count = 6): PageContent {
  return content.map((b) => (b.type === "gallery" && b.props.images.length === 0 ? { ...b, props: { ...b.props, images: Array.from({ length: count }).map((_, i) => ({ fileId: `00000000-0000-4000-8000-ffffffff000${i}`, caption: `Exemple ${i + 1}`, alt: `Exemple d'image ${i + 1}` })) } } : b));
}

/**
 * Fills the hero, the "about" picture and the gallery with catalogue photos
 * matching the persona (sample ids, see sample-photos.ts). Used by the public
 * template gallery, the picker and the workspace thumbnail of a draft.
 */
export function withSamplePhotos(content: PageContent, templateKey: string, count = 6): PageContent {
  const template = getTemplateOrDefault(templateKey);
  const persona = PERSONAS[TEMPLATE_PERSONA[template.key] ?? "wedding"] ?? (PERSONAS.wedding as Persona);
  const photos = samplePhotosFor(persona.photos, count + 2);
  const [cover, portrait, ...gallery] = photos;
  return content.map((b): Block => {
    if (b.type === "hero" && !b.props.imageFileId && cover) return { ...b, props: { ...b.props, imageFileId: sampleFileIdForPhoto(cover), imageAlt: `${cover.alt} (photo de démonstration)` } };
    if (b.type === "about" && !b.props.imageFileId && portrait) return { ...b, props: { ...b.props, imageFileId: sampleFileIdForPhoto(portrait), imageAlt: `${portrait.alt} (photo de démonstration)` } };
    if (b.type === "gallery" && b.props.images.length === 0) {
      return { ...b, props: { ...b.props, images: gallery.slice(0, count).map((p) => ({ fileId: sampleFileIdForPhoto(p), alt: `${p.alt} (photo de démonstration)`, caption: p.alt })) } };
    }
    return b;
  });
}
