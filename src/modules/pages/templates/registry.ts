import type { BlockType, RadiusOption } from "@/modules/pages/domain/page-schema";

/**
 * Code-defined templates. The database only stores a template key, a palette
 * key and small theme overrides; everything visual lives here and in
 * `src/components/pages/templates/<key>.tsx`. Adding a template = one entry
 * here + one component. Keys are referenced by `professional_categories.suggested_templates`.
 */
export type TemplateUniverse =
  | "élégant"
  | "minimaliste"
  | "champêtre"
  | "bohème"
  | "luxe"
  | "floral"
  | "moderne"
  | "festif"
  | "artistique"
  | "enfantin raffiné"
  | "corporate"
  | "nature"
  | "photographique"
  | "gastronomique"
  | "musical"
  | "spectacle";

export type PaletteColors = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentContrast: string;
  border: string;
};

export type Palette = { key: string; name: string; light: PaletteColors; dark: PaletteColors };

export const FONT_PAIRINGS = {
  "fraunces-figtree": { name: "Fraunces & Figtree", heading: '"Fraunces Variable", Georgia, serif', body: '"Figtree Variable", system-ui, sans-serif' },
  "cormorant-figtree": { name: "Cormorant & Figtree", heading: '"Cormorant Variable", "Times New Roman", serif', body: '"Figtree Variable", system-ui, sans-serif' },
  "space-figtree": { name: "Space Grotesk & Figtree", heading: '"Space Grotesk Variable", system-ui, sans-serif', body: '"Figtree Variable", system-ui, sans-serif' },
  "space-space": { name: "Space Grotesk", heading: '"Space Grotesk Variable", system-ui, sans-serif', body: '"Space Grotesk Variable", system-ui, sans-serif' },
  "caveat-figtree": { name: "Caveat & Figtree", heading: '"Caveat Variable", "Comic Sans MS", cursive', body: '"Figtree Variable", system-ui, sans-serif' },
  "bricolage-figtree": { name: "Bricolage Grotesque & Figtree", heading: '"Bricolage Grotesque Variable", system-ui, sans-serif', body: '"Figtree Variable", system-ui, sans-serif' },
  "figtree-figtree": { name: "Figtree", heading: '"Figtree Variable", system-ui, sans-serif', body: '"Figtree Variable", system-ui, sans-serif' },
  "fraunces-fraunces": { name: "Fraunces", heading: '"Fraunces Variable", Georgia, serif', body: '"Fraunces Variable", Georgia, serif' },
  "cormorant-cormorant": { name: "Cormorant", heading: '"Cormorant Variable", serif', body: '"Cormorant Variable", serif' },
} as const;
export type FontPairingKey = keyof typeof FONT_PAIRINGS;

export type TemplateDefinition = {
  key: string;
  name: string;
  universe: TemplateUniverse;
  /** One sentence for the picker; written for the professional, not for us. */
  description: string;
  isFree: boolean;
  fontPairing: FontPairingKey;
  /** Pairings the professional may switch to (advanced customisation). */
  fontPairings: FontPairingKey[];
  palettes: Palette[];
  radius: RadiusOption;
  defaultSections: BlockType[];
  /** Category slugs this template suits best (the picker lists them first). */
  suggestedFor: string[];
};

const p = (key: string, name: string, light: PaletteColors, dark: PaletteColors): Palette => ({ key, name, light, dark });

export const TEMPLATES: TemplateDefinition[] = [
  {
    key: "nid-douillet",
    name: "Nid douillet",
    universe: "enfantin raffiné",
    description: "Chaleureux et rassurant : un en-tête arrondi, des tons de laine et des sections qui respirent, pensé pour les professionnels de l'enfance.",
    isFree: true,
    fontPairing: "fraunces-figtree",
    fontPairings: ["fraunces-figtree", "caveat-figtree", "figtree-figtree"],
    palettes: [
      p("laine", "Laine", { bg: "#fbf6ef", surface: "#ffffff", text: "#3a3330", muted: "#7a6f68", accent: "#aa6245", accentContrast: "#ffffff", border: "#eadfd3" }, { bg: "#231f1d", surface: "#2d2826", text: "#f3ebe3", muted: "#b8aba1", accent: "#e39a7c", accentContrast: "#2a1a12", border: "#3d3532" }),
      p("sauge", "Sauge", { bg: "#f4f7f2", surface: "#ffffff", text: "#2f3a31", muted: "#627063", accent: "#567b5e", accentContrast: "#ffffff", border: "#dde6dc" }, { bg: "#1d241f", surface: "#262f28", text: "#edf3ec", muted: "#a9b7ab", accent: "#8fbd98", accentContrast: "#14231a", border: "#34403a" }),
      p("myrtille", "Myrtille", { bg: "#f5f3fa", surface: "#ffffff", text: "#2f2b3d", muted: "#6f6983", accent: "#6a5aa8", accentContrast: "#ffffff", border: "#e3dff0" }, { bg: "#1f1c2a", surface: "#2a2638", text: "#efecf7", muted: "#b1aac6", accent: "#a89ae0", accentContrast: "#1b1530", border: "#3a3550" }),
    ],
    radius: "round",
    defaultSections: ["hero", "trust", "about", "services", "availability", "gallery", "testimonials", "faq", "zone", "contact"],
    suggestedFor: ["garde-enfants-evenementielle", "baby-sitting"],
  },
  {
    key: "ronde-enfantine",
    name: "Ronde enfantine",
    universe: "enfantin raffiné",
    description: "Joyeux sans être criard : titres manuscrits, pastilles colorées et une galerie en ribambelle pour les animations et spectacles d'enfants.",
    isFree: false,
    fontPairing: "caveat-figtree",
    fontPairings: ["caveat-figtree", "bricolage-figtree", "fraunces-figtree"],
    palettes: [
      p("ribambelle", "Ribambelle", { bg: "#fffdf7", surface: "#fff5e1", text: "#33302b", muted: "#746d61", accent: "#be5433", accentContrast: "#ffffff", border: "#f3e4c2" }, { bg: "#24211c", surface: "#2f2a22", text: "#f7f1e6", muted: "#bfb5a5", accent: "#ff9d7a", accentContrast: "#2d1a10", border: "#423a2e" }),
      p("lagon", "Lagon", { bg: "#f3fbfb", surface: "#e3f4f4", text: "#243638", muted: "#5a6e71", accent: "#0e8282", accentContrast: "#ffffff", border: "#cfe6e6" }, { bg: "#182424", surface: "#213030", text: "#e9f6f6", muted: "#a6bdbd", accent: "#5fd3d3", accentContrast: "#0a2626", border: "#2f4242" }),
    ],
    radius: "round",
    defaultSections: ["hero", "services", "gallery", "about", "testimonials", "faq", "trust", "zone", "cta_quote", "contact"],
    suggestedFor: ["animation-enfants", "clown", "magicien"],
  },
  {
    key: "sauge-elegante",
    name: "Sauge élégante",
    universe: "élégant",
    description: "Sobre et raffiné : un en-tête divisé image/texte, des titres fins en Cormorant et une mise en page aérée pour les mariages.",
    isFree: true,
    fontPairing: "cormorant-figtree",
    fontPairings: ["cormorant-figtree", "fraunces-figtree", "cormorant-cormorant"],
    palettes: [
      p("sauge", "Sauge", { bg: "#f7f8f4", surface: "#ffffff", text: "#2b332c", muted: "#687065", accent: "#5b7a62", accentContrast: "#ffffff", border: "#dfe5dc" }, { bg: "#1c211d", surface: "#252c26", text: "#eef2ec", muted: "#a7b2a7", accent: "#9dc3a4", accentContrast: "#142018", border: "#343d35" }),
      p("ivoire-or", "Ivoire & or", { bg: "#faf7f0", surface: "#ffffff", text: "#2f2b24", muted: "#746d5e", accent: "#8d702b", accentContrast: "#ffffff", border: "#e9e1cf" }, { bg: "#211f1a", surface: "#2b2822", text: "#f3efe5", muted: "#b7ae9c", accent: "#d9b85d", accentContrast: "#241b05", border: "#3d3930" }),
      p("ardoise", "Ardoise", { bg: "#f4f5f7", surface: "#ffffff", text: "#252a33", muted: "#636a77", accent: "#4a5b7a", accentContrast: "#ffffff", border: "#dde1e8" }, { bg: "#1b1e24", surface: "#24282f", text: "#edf0f5", muted: "#a4abb8", accent: "#9fb3d6", accentContrast: "#0f1620", border: "#333944" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "about", "services", "gallery", "testimonials", "trust", "pricing", "faq", "zone", "contact"],
    suggestedFor: ["wedding-planner", "garde-enfants-evenementielle", "decorateur"],
  },
  {
    key: "minimal-ivoire",
    name: "Minimal ivoire",
    universe: "minimaliste",
    description: "Presque rien : une seule famille de caractères, beaucoup de blanc, des filets fins. Le contenu fait tout le travail.",
    isFree: true,
    fontPairing: "figtree-figtree",
    fontPairings: ["figtree-figtree", "space-space", "fraunces-figtree"],
    palettes: [
      p("ivoire", "Ivoire", { bg: "#fcfbf8", surface: "#fcfbf8", text: "#1f1f1d", muted: "#6b6a65", accent: "#1f1f1d", accentContrast: "#ffffff", border: "#e4e2dc" }, { bg: "#1b1b1a", surface: "#1b1b1a", text: "#f1f0ec", muted: "#a3a29c", accent: "#f1f0ec", accentContrast: "#1b1b1a", border: "#34332f" }),
      p("brume", "Brume", { bg: "#f6f7f8", surface: "#f6f7f8", text: "#1d2126", muted: "#67707a", accent: "#2f5d8a", accentContrast: "#ffffff", border: "#dfe3e7" }, { bg: "#171a1d", surface: "#171a1d", text: "#eef1f4", muted: "#9aa3ad", accent: "#8fbbe8", accentContrast: "#0c1a28", border: "#2d3339" }),
    ],
    radius: "sharp",
    defaultSections: ["hero", "about", "services", "pricing", "gallery", "faq", "trust", "zone", "contact"],
    suggestedFor: ["baby-sitting", "patissier", "maquilleur", "coiffeur", "location-materiel", "transport"],
  },
  {
    key: "confettis",
    name: "Confettis",
    universe: "festif",
    description: "Des aplats francs, des titres larges en Bricolage et des bandes colorées qui s'enchaînent : pour les animations et les soirées.",
    isFree: false,
    fontPairing: "bricolage-figtree",
    fontPairings: ["bricolage-figtree", "space-figtree", "caveat-figtree"],
    palettes: [
      p("carnaval", "Carnaval", { bg: "#fff8ee", surface: "#ffe9c2", text: "#2a2320", muted: "#6f6358", accent: "#d6336c", accentContrast: "#ffffff", border: "#f3d9a8" }, { bg: "#241d1b", surface: "#352a22", text: "#fbf1e6", muted: "#c3b3a5", accent: "#ff6b9d", accentContrast: "#2d0a18", border: "#4a3b30" }),
      p("citron", "Citron & bleu", { bg: "#fbfbea", surface: "#f3f3b8", text: "#1f2430", muted: "#5d6473", accent: "#2457d6", accentContrast: "#ffffff", border: "#e3e39a" }, { bg: "#1c1f2a", surface: "#2a2e3e", text: "#f1f3fb", muted: "#aab1c4", accent: "#8fb0ff", accentContrast: "#0b1a44", border: "#3b4157" }),
      p("menthe", "Menthe & corail", { bg: "#f1fbf6", surface: "#d4f3e3", text: "#1e2b24", muted: "#5b6f64", accent: "#c15032", accentContrast: "#ffffff", border: "#b7e4cd" }, { bg: "#18231d", surface: "#223229", text: "#eaf7ef", muted: "#a2bbab", accent: "#ff9270", accentContrast: "#2d1008", border: "#31463a" }),
    ],
    radius: "round",
    defaultSections: ["hero", "services", "gallery", "testimonials", "about", "faq", "cta_quote", "trust", "zone", "contact"],
    suggestedFor: ["animation-enfants", "dj", "clown", "animateur", "location-photobooth", "magicien"],
  },
  {
    key: "atelier-creatif",
    name: "Atelier créatif",
    universe: "artistique",
    description: "Une mise en page en collage : images légèrement inclinées, blocs de papier épinglés et titres irréguliers pour les décorateurs et ateliers.",
    isFree: false,
    fontPairing: "bricolage-figtree",
    fontPairings: ["bricolage-figtree", "caveat-figtree", "fraunces-figtree"],
    palettes: [
      p("kraft", "Kraft", { bg: "#efe6d8", surface: "#fbf7ef", text: "#2b2622", muted: "#6c6259", accent: "#2f6f8f", accentContrast: "#ffffff", border: "#d9ccb8" }, { bg: "#211e1a", surface: "#2d2924", text: "#f3ede4", muted: "#b7aca0", accent: "#7fc0dd", accentContrast: "#0b2230", border: "#413a32" }),
      p("gouache", "Gouache", { bg: "#f6f4ff", surface: "#ffffff", text: "#272437", muted: "#6b6680", accent: "#cc3f70", accentContrast: "#ffffff", border: "#e1ddf4" }, { bg: "#1d1b28", surface: "#282536", text: "#f0eefa", muted: "#afa9c6", accent: "#ff7fae", accentContrast: "#30091a", border: "#3a364d" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "gallery", "about", "services", "testimonials", "faq", "trust", "zone", "cta_quote", "contact"],
    suggestedFor: ["decorateur", "animation-enfants", "fleuriste"],
  },
  {
    key: "editorial-luxe",
    name: "Éditorial luxe",
    universe: "luxe",
    description: "Comme une double page de magazine : grandes capitales Cormorant, colonnes asymétriques, noir profond et crème.",
    isFree: false,
    fontPairing: "cormorant-figtree",
    fontPairings: ["cormorant-figtree", "cormorant-cormorant", "fraunces-figtree"],
    palettes: [
      p("encre", "Encre & crème", { bg: "#f6f1e8", surface: "#ffffff", text: "#161412", muted: "#5f5a53", accent: "#161412", accentContrast: "#f6f1e8", border: "#dcd3c5" }, { bg: "#131211", surface: "#1c1a18", text: "#f1ebe1", muted: "#aaa296", accent: "#f1ebe1", accentContrast: "#131211", border: "#2e2b27" }),
      p("champagne", "Champagne", { bg: "#f8f4ec", surface: "#ffffff", text: "#2a251f", muted: "#6d665b", accent: "#8c6a2d", accentContrast: "#ffffff", border: "#e5dccb" }, { bg: "#1a1814", surface: "#24211c", text: "#f4efe5", muted: "#b5ac9c", accent: "#d4b46a", accentContrast: "#231a06", border: "#352f27" }),
      p("bordeaux", "Bordeaux", { bg: "#f7f2f1", surface: "#ffffff", text: "#241619", muted: "#6c5a5e", accent: "#6e1f2e", accentContrast: "#ffffff", border: "#e6d8da" }, { bg: "#191213", surface: "#241b1d", text: "#f5eceb", muted: "#b6a3a6", accent: "#e08a98", accentContrast: "#2a0a10", border: "#382a2d" }),
    ],
    radius: "sharp",
    defaultSections: ["hero", "about", "gallery", "services", "pricing", "testimonials", "trust", "faq", "zone", "contact"],
    suggestedFor: ["wedding-planner", "domaine-reception", "traiteur", "decorateur", "maquilleur"],
  },
  {
    key: "boheme-lin",
    name: "Bohème lin",
    universe: "bohème",
    description: "Lin, terre cuite et notes manuscrites : des sections décalées, des coins adoucis et une galerie façon carnet pour les univers naturels.",
    isFree: false,
    fontPairing: "fraunces-figtree",
    fontPairings: ["fraunces-figtree", "caveat-figtree", "cormorant-figtree"],
    palettes: [
      p("lin", "Lin", { bg: "#f3eee4", surface: "#faf7f0", text: "#3b322b", muted: "#6e6258", accent: "#a65f3b", accentContrast: "#ffffff", border: "#e1d6c6" }, { bg: "#221e1a", surface: "#2d2823", text: "#f2ebe1", muted: "#b9ac9d", accent: "#e39b78", accentContrast: "#2a160c", border: "#3f372f" }),
      p("olive", "Olive", { bg: "#f1f0e6", surface: "#f9f8f1", text: "#30332a", muted: "#60645a", accent: "#6f7a3a", accentContrast: "#ffffff", border: "#dcdac8" }, { bg: "#1f201a", surface: "#2a2b23", text: "#eeefe6", muted: "#b0b3a2", accent: "#b7c470", accentContrast: "#1b2006", border: "#3a3c31" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "about", "gallery", "services", "testimonials", "zone", "faq", "trust", "social", "contact"],
    suggestedFor: ["wedding-planner", "decorateur", "musicien", "location-mobilier", "hebergement"],
  },
  {
    key: "champetre-pierre",
    name: "Champêtre pierre",
    universe: "champêtre",
    description: "Pierre blonde, feuillage, lignes horizontales et une large bande photo : la fiche d'un lieu ou d'un traiteur à la campagne.",
    isFree: true,
    fontPairing: "fraunces-figtree",
    fontPairings: ["fraunces-figtree", "cormorant-figtree", "figtree-figtree"],
    palettes: [
      p("pierre", "Pierre", { bg: "#f5f1ea", surface: "#fdfbf7", text: "#31302c", muted: "#6f6c64", accent: "#677b4d", accentContrast: "#ffffff", border: "#e2dccf" }, { bg: "#1f1e1b", surface: "#2a2824", text: "#f1eee7", muted: "#b2ada2", accent: "#a9c088", accentContrast: "#17200c", border: "#3a3832" }),
      p("lavande", "Lavande", { bg: "#f5f3f8", surface: "#fcfbfe", text: "#2f2c38", muted: "#6c6878", accent: "#6f5e9c", accentContrast: "#ffffff", border: "#e1dceb" }, { bg: "#1d1b23", surface: "#28252f", text: "#f0eef6", muted: "#afaabe", accent: "#b3a3e0", accentContrast: "#1a1230", border: "#393546" }),
      p("miel", "Miel", { bg: "#f8f3e8", surface: "#fffdf7", text: "#332d24", muted: "#746c5e", accent: "#9e671c", accentContrast: "#ffffff", border: "#e8dfcc" }, { bg: "#211d17", surface: "#2c2720", text: "#f4efe5", muted: "#b8ae9d", accent: "#e8b457", accentContrast: "#2a1c04", border: "#3f382d" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "about", "services", "gallery", "availability", "zone", "testimonials", "faq", "trust", "contact"],
    suggestedFor: ["domaine-reception", "traiteur", "fleuriste", "hebergement"],
  },
  {
    key: "panorama-photo",
    name: "Panorama photo",
    universe: "photographique",
    description: "L'image d'abord : un en-tête plein écran, une navigation ancrée discrète et une galerie mosaïque qui occupe toute la largeur.",
    isFree: true,
    fontPairing: "figtree-figtree",
    fontPairings: ["figtree-figtree", "space-figtree", "fraunces-figtree"],
    palettes: [
      p("neutre", "Neutre", { bg: "#ffffff", surface: "#f5f5f4", text: "#1c1c1b", muted: "#6a6966", accent: "#1c1c1b", accentContrast: "#ffffff", border: "#e6e5e2" }, { bg: "#121212", surface: "#1c1c1c", text: "#f4f4f2", muted: "#a2a19d", accent: "#f4f4f2", accentContrast: "#121212", border: "#2b2b2a" }),
      p("cuivre", "Cuivre", { bg: "#fffdfa", surface: "#f6f0e9", text: "#241f1b", muted: "#6f655d", accent: "#9c5a33", accentContrast: "#ffffff", border: "#e8ddd1" }, { bg: "#161311", surface: "#211c18", text: "#f5efe9", muted: "#aa9f95", accent: "#e39a6f", accentContrast: "#2a1409", border: "#322a24" }),
    ],
    radius: "sharp",
    defaultSections: ["hero", "gallery", "about", "services", "pricing", "testimonials", "trust", "zone", "faq", "contact"],
    suggestedFor: ["photographe", "videaste", "domaine-reception", "salle-evenementielle"],
  },
  {
    key: "corporate-net",
    name: "Corporate net",
    universe: "corporate",
    description: "Clair et structuré : sommaire latéral collant, cartes d'information régulières et un ton professionnel pour les salles, la logistique et le B2B.",
    isFree: true,
    fontPairing: "space-figtree",
    fontPairings: ["space-figtree", "figtree-figtree", "space-space"],
    palettes: [
      p("marine", "Marine", { bg: "#f7f8fa", surface: "#ffffff", text: "#182033", muted: "#5d667a", accent: "#1f4e9c", accentContrast: "#ffffff", border: "#dfe3ea" }, { bg: "#14171e", surface: "#1d2129", text: "#eef1f7", muted: "#9ba4b5", accent: "#7fa8f0", accentContrast: "#071633", border: "#2d333f" }),
      p("graphite", "Graphite", { bg: "#f6f6f6", surface: "#ffffff", text: "#1d1f22", muted: "#616670", accent: "#2b7a63", accentContrast: "#ffffff", border: "#e1e3e6" }, { bg: "#161718", surface: "#1f2123", text: "#f0f1f2", muted: "#9ea3aa", accent: "#6fcfae", accentContrast: "#04291f", border: "#2f3236" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "services", "about", "pricing", "trust", "availability", "zone", "faq", "testimonials", "contact"],
    suggestedFor: ["salle-evenementielle", "location-materiel", "location-mobilier", "animateur", "transport"],
  },
  {
    key: "moderne-grille",
    name: "Moderne grille",
    universe: "moderne",
    description: "Une grille de tuiles aux tailles variées : les informations clés tiennent sur un écran, le reste suit en rangées nettes.",
    isFree: false,
    fontPairing: "space-space",
    fontPairings: ["space-space", "space-figtree", "figtree-figtree"],
    palettes: [
      p("craie", "Craie", { bg: "#f3f3f1", surface: "#ffffff", text: "#1a1a1a", muted: "#62625f", accent: "#c9492a", accentContrast: "#ffffff", border: "#e0e0dc" }, { bg: "#141414", surface: "#1f1f1f", text: "#f3f3f1", muted: "#a1a19d", accent: "#ff8463", accentContrast: "#2b0d04", border: "#2e2e2d" }),
      p("cobalt", "Cobalt", { bg: "#f2f4f9", surface: "#ffffff", text: "#141a2b", muted: "#5b6478", accent: "#2740d8", accentContrast: "#ffffff", border: "#dde1ec" }, { bg: "#12151f", surface: "#1b1f2c", text: "#eef1f9", muted: "#9ba4ba", accent: "#8ea0ff", accentContrast: "#0a1140", border: "#2b3042" }),
      p("acide", "Acide", { bg: "#f6f7f2", surface: "#ffffff", text: "#191c14", muted: "#5f655a", accent: "#488200", accentContrast: "#ffffff", border: "#e1e4da" }, { bg: "#141610", surface: "#1d2018", text: "#f1f3ea", muted: "#a0a697", accent: "#a8e84a", accentContrast: "#15230a", border: "#2d3126" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "services", "gallery", "pricing", "about", "testimonials", "trust", "zone", "faq", "contact"],
    suggestedFor: ["salle-evenementielle", "dj", "videaste", "location-materiel", "location-photobooth", "location-mobilier"],
  },
  {
    key: "table-gourmande",
    name: "Table gourmande",
    universe: "gastronomique",
    description: "Une carte de restaurant : prestations alignées comme un menu, filets pointillés, photos en bandeau et tons de nappe.",
    isFree: false,
    fontPairing: "fraunces-fraunces",
    fontPairings: ["fraunces-fraunces", "fraunces-figtree", "cormorant-figtree"],
    palettes: [
      p("nappe", "Nappe", { bg: "#fbf7f1", surface: "#ffffff", text: "#2e241e", muted: "#6f635a", accent: "#8f2f2f", accentContrast: "#ffffff", border: "#e9ddd0" }, { bg: "#1f1916", surface: "#2a221e", text: "#f6efe8", muted: "#b9aa9e", accent: "#e8857f", accentContrast: "#2d0b0b", border: "#3e342e" }),
      p("olive-noire", "Olive noire", { bg: "#f6f5ee", surface: "#fffffa", text: "#262a1f", muted: "#656a5a", accent: "#4a5a2a", accentContrast: "#ffffff", border: "#e0dfd0" }, { bg: "#1a1c15", surface: "#24271e", text: "#f0f1e8", muted: "#aab09c", accent: "#b5c87a", accentContrast: "#1a2206", border: "#343828" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "about", "services", "pricing", "gallery", "testimonials", "faq", "trust", "zone", "contact"],
    suggestedFor: ["traiteur", "patissier"],
  },
  {
    key: "poudre-rose",
    name: "Poudre rose",
    universe: "floral",
    description: "Délicat : rose poudré, filets dorés, titres Cormorant italiques et un portrait en médaillon pour la beauté et les fleurs.",
    isFree: false,
    fontPairing: "cormorant-figtree",
    fontPairings: ["cormorant-figtree", "cormorant-cormorant", "fraunces-figtree"],
    palettes: [
      p("poudre", "Poudre", { bg: "#fbf4f3", surface: "#ffffff", text: "#3a2a2d", muted: "#7e6a6e", accent: "#ad5d6a", accentContrast: "#ffffff", border: "#eedcdc" }, { bg: "#241c1e", surface: "#2f2527", text: "#f6ecee", muted: "#bba9ad", accent: "#eaa0ab", accentContrast: "#2d0f16", border: "#413436" }),
      p("pivoine", "Pivoine", { bg: "#fdf5f8", surface: "#ffffff", text: "#35252d", muted: "#7a6672", accent: "#c23a7a", accentContrast: "#ffffff", border: "#f1dbe5" }, { bg: "#241a20", surface: "#2f232a", text: "#f8edf2", muted: "#bda7b4", accent: "#f08cbd", accentContrast: "#330a1e", border: "#44323a" }),
      p("sable-dore", "Sable doré", { bg: "#fbf7f0", surface: "#ffffff", text: "#342e26", muted: "#776e62", accent: "#8d6e33", accentContrast: "#ffffff", border: "#ebe2d2" }, { bg: "#221f19", surface: "#2d2922", text: "#f5f0e6", muted: "#b9af9f", accent: "#dcb86a", accentContrast: "#2a1d05", border: "#3f3a31" }),
    ],
    radius: "round",
    defaultSections: ["hero", "about", "services", "gallery", "pricing", "testimonials", "trust", "faq", "zone", "social", "contact"],
    suggestedFor: ["maquilleur", "coiffeur", "fleuriste", "patissier"],
  },
  {
    key: "galerie-noire",
    name: "Galerie noire",
    universe: "photographique",
    description: "Une galerie d'exposition : fond sombre, images lumineuses bord à bord, légendes discrètes et une navigation en haut qui s'efface.",
    isFree: false,
    fontPairing: "figtree-figtree",
    fontPairings: ["figtree-figtree", "space-figtree", "cormorant-figtree"],
    palettes: [
      p("noir", "Noir", { bg: "#111111", surface: "#1a1a1a", text: "#f3f3f1", muted: "#a3a3a0", accent: "#f3f3f1", accentContrast: "#111111", border: "#2a2a2a" }, { bg: "#0c0c0c", surface: "#161616", text: "#f3f3f1", muted: "#a3a3a0", accent: "#f3f3f1", accentContrast: "#0c0c0c", border: "#262626" }),
      p("anthracite-cuivre", "Anthracite & cuivre", { bg: "#17171a", surface: "#202024", text: "#f2f1ee", muted: "#a6a39e", accent: "#d99a6c", accentContrast: "#2a1508", border: "#2f2f34" }, { bg: "#111114", surface: "#1a1a1e", text: "#f2f1ee", muted: "#a6a39e", accent: "#d99a6c", accentContrast: "#2a1508", border: "#29292e" }),
    ],
    radius: "sharp",
    defaultSections: ["hero", "gallery", "about", "services", "testimonials", "pricing", "trust", "zone", "faq", "contact"],
    suggestedFor: ["photographe", "videaste"],
  },
  {
    key: "argentique",
    name: "Argentique",
    universe: "photographique",
    description: "Le grain d'un tirage ancien : cadres épais, titres italiques, numérotation de planche-contact et tons sépia.",
    isFree: false,
    fontPairing: "fraunces-figtree",
    fontPairings: ["fraunces-figtree", "fraunces-fraunces", "cormorant-figtree"],
    palettes: [
      p("sepia", "Sépia", { bg: "#f1e9dc", surface: "#faf5ec", text: "#2e2520", muted: "#6f6256", accent: "#5e4634", accentContrast: "#ffffff", border: "#dccfbb" }, { bg: "#1d1813", surface: "#27201a", text: "#f1e8db", muted: "#b3a492", accent: "#d6b58f", accentContrast: "#241709", border: "#3b3128" }),
      p("argent", "Argent", { bg: "#eeeeec", surface: "#f8f8f6", text: "#232322", muted: "#66665f", accent: "#3f3f3b", accentContrast: "#ffffff", border: "#d7d7d2" }, { bg: "#171716", surface: "#212120", text: "#efefec", muted: "#a2a29c", accent: "#d8d8d2", accentContrast: "#171716", border: "#333331" }),
    ],
    radius: "sharp",
    defaultSections: ["hero", "about", "gallery", "services", "pricing", "testimonials", "trust", "zone", "faq", "contact"],
    suggestedFor: ["photographe", "musicien", "coiffeur", "transport"],
  },
  {
    key: "nuit-electrique",
    name: "Nuit électrique",
    universe: "musical",
    description: "Fond nuit, halos de couleur et titres très larges en Space Grotesk : la fiche d'un DJ ou d'un photobooth de soirée.",
    isFree: false,
    fontPairing: "space-space",
    fontPairings: ["space-space", "space-figtree", "bricolage-figtree"],
    palettes: [
      p("violet", "Violet", { bg: "#0f0b1e", surface: "#1a1430", text: "#f3efff", muted: "#aba3c9", accent: "#c084fc", accentContrast: "#1c0a35", border: "#2c2448" }, { bg: "#0b0817", surface: "#151027", text: "#f3efff", muted: "#aba3c9", accent: "#c084fc", accentContrast: "#1c0a35", border: "#261e40" }),
      p("cyan", "Cyan", { bg: "#071318", surface: "#0e1f27", text: "#eafbff", muted: "#95b5bf", accent: "#22d3ee", accentContrast: "#042a33", border: "#1b333d" }, { bg: "#050e12", surface: "#0b1a21", text: "#eafbff", muted: "#95b5bf", accent: "#22d3ee", accentContrast: "#042a33", border: "#162a33" }),
      p("magenta", "Magenta", { bg: "#160912", surface: "#24101d", text: "#fff0f8", muted: "#c5a0b6", accent: "#f472b6", accentContrast: "#3a0a24", border: "#3a1d30" }, { bg: "#10070d", surface: "#1d0c17", text: "#fff0f8", muted: "#c5a0b6", accent: "#f472b6", accentContrast: "#3a0a24", border: "#32182a" }),
    ],
    radius: "round",
    defaultSections: ["hero", "services", "gallery", "testimonials", "about", "pricing", "faq", "trust", "zone", "social", "contact"],
    suggestedFor: ["dj", "location-photobooth", "animateur"],
  },
  {
    key: "scene-ouverte",
    name: "Scène ouverte",
    universe: "spectacle",
    description: "Une affiche de concert : titre géant qui déborde, bandeau de dates, blocs contrastés et typographie Bricolage condensée.",
    isFree: false,
    fontPairing: "bricolage-figtree",
    fontPairings: ["bricolage-figtree", "space-figtree", "fraunces-figtree"],
    palettes: [
      p("affiche", "Affiche", { bg: "#f6efe0", surface: "#ffffff", text: "#1d1a16", muted: "#605a4f", accent: "#c8102e", accentContrast: "#ffffff", border: "#e3d8c1" }, { bg: "#1a1713", surface: "#24201a", text: "#f6efe0", muted: "#b2a996", accent: "#ff5d6e", accentContrast: "#330710", border: "#38322a" }),
      p("ocre", "Ocre", { bg: "#f8f1e3", surface: "#fffaf0", text: "#23201b", muted: "#665f54", accent: "#b15f12", accentContrast: "#ffffff", border: "#e7dbc3" }, { bg: "#1c1813", surface: "#27211a", text: "#f8f1e3", muted: "#b5ab99", accent: "#ff9d49", accentContrast: "#331a04", border: "#3b332a" }),
      p("indigo", "Indigo", { bg: "#eef0fa", surface: "#ffffff", text: "#161a35", muted: "#5a607f", accent: "#2d2f9e", accentContrast: "#ffffff", border: "#d9dcf0" }, { bg: "#12141f", surface: "#1b1e2d", text: "#eef0fa", muted: "#9ea4c2", accent: "#9b9ff0", accentContrast: "#0d0f40", border: "#2c3047" }),
    ],
    radius: "sharp",
    defaultSections: ["hero", "about", "services", "gallery", "testimonials", "pricing", "faq", "trust", "zone", "social", "contact"],
    suggestedFor: ["musicien", "magicien", "animateur", "clown"],
  },
  {
    key: "velours-spectacle",
    name: "Velours spectacle",
    universe: "spectacle",
    description: "Rideau de velours, dorures mesurées et titres Cormorant : pour les magiciens, clowns et spectacles à l'ancienne.",
    isFree: false,
    fontPairing: "cormorant-figtree",
    fontPairings: ["cormorant-figtree", "cormorant-cormorant", "fraunces-figtree"],
    palettes: [
      p("grenat", "Grenat", { bg: "#2a1016", surface: "#3a1820", text: "#f8ece9", muted: "#c9a9a9", accent: "#e0b35a", accentContrast: "#2a1a05", border: "#4d2630" }, { bg: "#1e0b10", surface: "#2c1218", text: "#f8ece9", muted: "#c9a9a9", accent: "#e0b35a", accentContrast: "#2a1a05", border: "#3e1d25" }),
      p("emeraude", "Émeraude", { bg: "#0f2420", surface: "#16322c", text: "#eef7f3", muted: "#9fbcb3", accent: "#e3c06b", accentContrast: "#2a1f05", border: "#244740" }, { bg: "#0a1b18", surface: "#112823", text: "#eef7f3", muted: "#9fbcb3", accent: "#e3c06b", accentContrast: "#2a1f05", border: "#1f3b35" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "services", "about", "gallery", "testimonials", "faq", "pricing", "trust", "zone", "contact"],
    suggestedFor: ["magicien", "clown", "musicien"],
  },
  {
    key: "jardin-fleuri",
    name: "Jardin fleuri",
    universe: "floral",
    description: "Un herbier : fond papier, encadrés végétaux, galerie en planches botaniques et titres Fraunces aux empattements doux.",
    isFree: false,
    fontPairing: "fraunces-figtree",
    fontPairings: ["fraunces-figtree", "cormorant-figtree", "caveat-figtree"],
    palettes: [
      p("herbier", "Herbier", { bg: "#f6f5ee", surface: "#fdfdf8", text: "#2c3328", muted: "#6b7366", accent: "#3f7a4d", accentContrast: "#ffffff", border: "#dfe0d0" }, { bg: "#1b1f19", surface: "#252a22", text: "#eef2ea", muted: "#a8b2a3", accent: "#8fd19e", accentContrast: "#0f2a16", border: "#353b31" }),
      p("pivoine", "Pivoine", { bg: "#fbf4f4", surface: "#fffafa", text: "#352a2d", muted: "#79696d", accent: "#ba516c", accentContrast: "#ffffff", border: "#eed9db" }, { bg: "#221a1c", surface: "#2d2426", text: "#f7edef", muted: "#bca9ad", accent: "#f299ad", accentContrast: "#330c17", border: "#413436" }),
      p("glycine", "Glycine", { bg: "#f6f4fa", surface: "#fdfcff", text: "#302c3d", muted: "#6f6a80", accent: "#7259ad", accentContrast: "#ffffff", border: "#e2def0" }, { bg: "#1d1a26", surface: "#282433", text: "#f1eef9", muted: "#b0aac4", accent: "#b7a4ee", accentContrast: "#1b1136", border: "#3a3549" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "about", "gallery", "services", "pricing", "testimonials", "trust", "zone", "faq", "social", "contact"],
    suggestedFor: ["fleuriste", "decorateur"],
  },
  {
    key: "nature-foret",
    name: "Nature forêt",
    universe: "nature",
    description: "Verts profonds, bois clair et grandes photos de paysage ; les sections se posent comme des clairières. Pour les hébergements et lieux au vert.",
    isFree: false,
    fontPairing: "fraunces-figtree",
    fontPairings: ["fraunces-figtree", "figtree-figtree", "space-figtree"],
    palettes: [
      p("sous-bois", "Sous-bois", { bg: "#eef2ea", surface: "#f9fbf6", text: "#1f2b22", muted: "#5c6c61", accent: "#2f5d3f", accentContrast: "#ffffff", border: "#d5ddd0" }, { bg: "#141c17", surface: "#1d271f", text: "#e9f1ea", muted: "#9db0a2", accent: "#7fbf93", accentContrast: "#0a2213", border: "#2c382f" }),
      p("ecorce", "Écorce", { bg: "#f3efe9", surface: "#fbf9f5", text: "#2b241f", muted: "#6c635b", accent: "#7a5433", accentContrast: "#ffffff", border: "#e0d8ce" }, { bg: "#1b1714", surface: "#26211c", text: "#f1ece6", muted: "#b1a69b", accent: "#d4a47c", accentContrast: "#2a1708", border: "#38312b" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "about", "gallery", "services", "availability", "zone", "testimonials", "faq", "trust", "contact"],
    suggestedFor: ["hebergement", "domaine-reception", "transport"],
  },
  {
    key: "lumiere-studio",
    name: "Lumière studio",
    universe: "minimaliste",
    description: "Un studio inondé de lumière : fond blanc pur, portrait en grand, typographie très large et tableau de prestations net. Pour la beauté et le portrait.",
    isFree: false,
    fontPairing: "space-figtree",
    fontPairings: ["space-figtree", "figtree-figtree", "cormorant-figtree"],
    palettes: [
      p("blanc", "Blanc", { bg: "#ffffff", surface: "#f7f7f7", text: "#171717", muted: "#6b6b6b", accent: "#171717", accentContrast: "#ffffff", border: "#e8e8e8" }, { bg: "#141414", surface: "#1e1e1e", text: "#f5f5f5", muted: "#a5a5a5", accent: "#f5f5f5", accentContrast: "#141414", border: "#2c2c2c" }),
      p("perle", "Perle", { bg: "#fdfbfb", surface: "#f5eff0", text: "#241c1e", muted: "#766a6d", accent: "#976874", accentContrast: "#ffffff", border: "#eadfe1" }, { bg: "#161213", surface: "#201a1c", text: "#f7f1f2", muted: "#aa9ea1", accent: "#dcaab7", accentContrast: "#2d141c", border: "#312829" }),
    ],
    radius: "sharp",
    defaultSections: ["hero", "services", "gallery", "about", "pricing", "testimonials", "trust", "faq", "zone", "social", "contact"],
    suggestedFor: ["maquilleur", "coiffeur", "photographe"],
  },
  {
    key: "terrasse-azur",
    name: "Terrasse azur",
    universe: "festif",
    description: "Carreaux de céramique, bleu profond et blanc chaulé : une ambiance de fête d'été au bord de l'eau pour les lieux et les traiteurs du Sud.",
    isFree: false,
    fontPairing: "fraunces-figtree",
    fontPairings: ["fraunces-figtree", "bricolage-figtree", "figtree-figtree"],
    palettes: [
      p("azur", "Azur", { bg: "#f7f9fb", surface: "#ffffff", text: "#172536", muted: "#5b6b7e", accent: "#1d5fa8", accentContrast: "#ffffff", border: "#d8e2ec" }, { bg: "#0f1a26", surface: "#182637", text: "#eaf2fb", muted: "#9db0c5", accent: "#79b1f2", accentContrast: "#06203d", border: "#283a4f" }),
      p("terre-cuite", "Terre cuite & mer", { bg: "#fbf7f2", surface: "#ffffff", text: "#2b2420", muted: "#6f635b", accent: "#1f7a8c", accentContrast: "#ffffff", border: "#e9ddd1" }, { bg: "#1c1715", surface: "#27211e", text: "#f6efe8", muted: "#b5a89d", accent: "#6cc5d6", accentContrast: "#042a31", border: "#3c322d" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "gallery", "about", "services", "pricing", "availability", "testimonials", "zone", "faq", "trust", "contact"],
    suggestedFor: ["domaine-reception", "traiteur", "salle-evenementielle", "hebergement"],
  },
  {
    key: "carnet-voyage",
    name: "Carnet de voyage",
    universe: "bohème",
    description: "Un carnet de route : pages épaisses, timbres, notes à la main et itinéraire de la prestation étape par étape. Pour les transports, hébergements et animateurs itinérants.",
    isFree: false,
    fontPairing: "caveat-figtree",
    fontPairings: ["caveat-figtree", "fraunces-figtree", "figtree-figtree"],
    palettes: [
      p("papier", "Papier", { bg: "#f6f2e8", surface: "#fdfaf3", text: "#2f2a24", muted: "#6f685d", accent: "#2d6a7b", accentContrast: "#ffffff", border: "#e2dac9" }, { bg: "#1f1c17", surface: "#2a2620", text: "#f3eee4", muted: "#b5ac9d", accent: "#7fc3d5", accentContrast: "#06262f", border: "#3c362e" }),
      p("sable", "Sable & rouille", { bg: "#f8f3ea", surface: "#fffcf5", text: "#302822", muted: "#74685d", accent: "#b4532c", accentContrast: "#ffffff", border: "#e8dfcf" }, { bg: "#201b16", surface: "#2b251f", text: "#f5efe6", muted: "#b8ac9e", accent: "#f0916a", accentContrast: "#2d1206", border: "#3e352d" }),
    ],
    radius: "soft",
    defaultSections: ["hero", "about", "services", "zone", "gallery", "testimonials", "availability", "faq", "trust", "contact"],
    suggestedFor: ["transport", "hebergement", "animateur", "musicien"],
  },
];

export const TEMPLATE_KEYS = TEMPLATES.map((t) => t.key);
export type TemplateKey = string;

const byKey = new Map(TEMPLATES.map((t) => [t.key, t]));

export function getTemplate(key: string): TemplateDefinition | undefined {
  return byKey.get(key);
}

export function getTemplateOrDefault(key: string | null | undefined): TemplateDefinition {
  return (key ? byKey.get(key) : undefined) ?? (byKey.get("minimal-ivoire") as TemplateDefinition);
}

export const FREE_TEMPLATE_KEYS = TEMPLATES.filter((t) => t.isFree).map((t) => t.key);

export function isFreeTemplate(key: string): boolean {
  return byKey.get(key)?.isFree ?? false;
}

export const TEMPLATE_UNIVERSES: TemplateUniverse[] = Array.from(new Set(TEMPLATES.map((t) => t.universe)));

/** Templates for a category: the category's suggestions first (in order), then the rest. */
export function orderTemplatesForCategory(suggested: string[]): TemplateDefinition[] {
  const first = suggested.map((k) => byKey.get(k)).filter((t): t is TemplateDefinition => Boolean(t));
  const rest = TEMPLATES.filter((t) => !suggested.includes(t.key));
  return [...first, ...rest];
}
