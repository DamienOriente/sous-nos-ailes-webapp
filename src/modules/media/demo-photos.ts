/**
 * Curated catalogue of free photographs (Unsplash licence: free to use, no
 * attribution required, no resale of the photo itself) used ONLY for the
 * demonstration environment: fictitious professionals, marketing pages and
 * illustrated empty states. Every entry was checked visually on 2026-10-17.
 * Loaded from images.unsplash.com (allowed in next.config remotePatterns and in
 * the CSP img-src). Before a commercial launch, replace them with licensed or
 * owned photography (docs/assets.md).
 */
export type PhotoTheme =
  | "wedding"
  | "cake"
  | "kids"
  | "balloons"
  | "confetti"
  | "reception"
  | "dj"
  | "food"
  | "terrace"
  | "landscape"
  | "room"
  | "venue"
  | "photo"
  | "flowers"
  | "seminar"
  | "family"
  | "toast"
  | "beauty"
  | "hair"
  | "car";

export type DemoPhoto = { id: string; theme: PhotoTheme; alt: string; /** Dominant colour used as placeholder background. */ tone: string };

export const DEMO_PHOTOS: readonly DemoPhoto[] = [
  { id: "1519741497674-611481863552", theme: "wedding", alt: "Jeunes mariés dans une lumière dorée", tone: "#d9c7b2" },
  { id: "1465495976277-4387d4b0b4c6", theme: "wedding", alt: "Mains des mariés et bouquet", tone: "#e6ddd1" },
  { id: "1511285560929-80b456fea0bc", theme: "wedding", alt: "Couple sous une pluie de pétales rouges", tone: "#c9b7a8" },
  { id: "1522673607200-164d1b6ce486", theme: "wedding", alt: "Chaises de cérémonie sur une pelouse", tone: "#b7c3a1" },
  { id: "1529636798458-92182e662485", theme: "wedding", alt: "Arche fleurie de cérémonie", tone: "#d8cfc3" },
  { id: "1460978812857-470ed1c77af0", theme: "wedding", alt: "Mariés enlacés en noir et blanc", tone: "#8f8f8f" },
  { id: "1583939003579-730e3918a45a", theme: "wedding", alt: "Mariés entourés de leurs invités", tone: "#c7d0d6" },
  { id: "1537633552985-df8429e8048b", theme: "wedding", alt: "Mariée de dos face à la mer", tone: "#9fa8ae" },
  { id: "1606800052052-a08af7148866", theme: "wedding", alt: "Alliances posées sur un support", tone: "#d6cdbf" },
  { id: "1591604466107-ec97de577aff", theme: "wedding", alt: "Mariés enlacés au bord de l'eau, bouquet à la main", tone: "#b9a77f" },
  { id: "1464349095431-e9a21285b5f3", theme: "cake", alt: "Gâteau coloré aux vermicelles, une part coupée", tone: "#2f2f3a" },
  { id: "1535254973040-607b474cb50d", theme: "cake", alt: "Wedding cake blanc à étages, décor de roses", tone: "#e9e2da" },
  { id: "1472162072942-cd5147eb3902", theme: "kids", alt: "Enfant qui rit sur un banc", tone: "#d6cfc4" },
  { id: "1503454537195-1dcabb73ffb9", theme: "kids", alt: "Petite fille au visage peint", tone: "#9db28a" },
  { id: "1544776193-352d25ca82cd", theme: "kids", alt: "Deux enfants qui lisent ensemble", tone: "#c8c2b4" },
  { id: "1587654780291-39c9404d746b", theme: "kids", alt: "Briques de construction colorées", tone: "#d85a4a" },
  { id: "1596464716127-f2a82984de30", theme: "kids", alt: "Atelier de dessin et feutres", tone: "#9a7f66" },
  { id: "1484820540004-14229fe36ca4", theme: "kids", alt: "Cubes en bois illustrés", tone: "#5a7fb2" },
  { id: "1515488042361-ee00e0ddd4e4", theme: "kids", alt: "Bébé entouré de jouets", tone: "#e4ded6" },
  { id: "1476234251651-f353703a034d", theme: "kids", alt: "Lecture d'un livre avec un enfant", tone: "#6f7f5a" },
  { id: "1502086223501-7ea6ecd79368", theme: "kids", alt: "Enfants qui sautent dans une forêt", tone: "#8fa37a" },
  { id: "1530103862676-de8c9debad1d", theme: "balloons", alt: "Ballons multicolores", tone: "#d0a86a" },
  { id: "1492684223066-81342ee5ff30", theme: "confetti", alt: "Confettis sur une foule en fête", tone: "#3a3f66" },
  { id: "1513151233558-d860c5398176", theme: "confetti", alt: "Confettis colorés sur fond bleu", tone: "#3c5fa0" },
  { id: "1464366400600-7168b8af9bc3", theme: "reception", alt: "Table de réception dressée", tone: "#d9d4cc" },
  { id: "1519167758481-83f550bb49b3", theme: "reception", alt: "Salle de banquet aux tables rondes", tone: "#c9b08a" },
  { id: "1470225620780-dba8ba36b745", theme: "dj", alt: "Mains d'un DJ sur les platines", tone: "#4a2a66" },
  { id: "1514525253161-7a46d19cd819", theme: "dj", alt: "Foule et jeux de lumière en concert", tone: "#4a3a8a" },
  { id: "1493225457124-a3eb161ffa5f", theme: "dj", alt: "Artiste dans la fumée de scène", tone: "#5c5c5c" },
  { id: "1516450360452-9312f5e86fc7", theme: "dj", alt: "Public sous les projecteurs", tone: "#7b3c6a" },
  { id: "1555244162-803834f70033", theme: "food", alt: "Buffet de cocktail", tone: "#b48a5a" },
  { id: "1414235077428-338989a2e8c0", theme: "food", alt: "Assiette gastronomique servie à table", tone: "#6b5a48" },
  { id: "1504674900247-0877df9cc836", theme: "food", alt: "Plats variés vus de dessus", tone: "#7d6a55" },
  { id: "1555939594-58d7cb561ad1", theme: "food", alt: "Planche de viandes grillées", tone: "#9c6a3f" },
  { id: "1476224203421-9ac39bcb3327", theme: "food", alt: "Assiette de saison", tone: "#8a6a4a" },
  { id: "1467003909585-2f8a72700288", theme: "food", alt: "Poisson dressé en restaurant", tone: "#5a4a3a" },
  { id: "1559339352-11d035aa65de", theme: "terrace", alt: "Terrasse de restaurant face au lac", tone: "#7fa3b8" },
  { id: "1464207687429-7505649dae38", theme: "landscape", alt: "Coucher de soleil sur les collines", tone: "#d08a4a" },
  { id: "1505693416388-ac5ce068fe85", theme: "room", alt: "Chambre d'hôtes lumineuse", tone: "#d8d2c8" },
  { id: "1542314831-068cd1dbfeeb", theme: "venue", alt: "Villa et piscine de nuit", tone: "#2e4a6a" },
  { id: "1600585154340-be6161a56a0c", theme: "venue", alt: "Maison contemporaine au crépuscule", tone: "#4a5a66" },
  { id: "1571896349842-33c89424de2d", theme: "venue", alt: "Domaine avec piscine éclairée", tone: "#5a6e7a" },
  { id: "1452587925148-ce544e77e70d", theme: "photo", alt: "Appareil photo argentique et tirages", tone: "#8a7a66" },
  { id: "1554048612-b6a482bc67e5", theme: "photo", alt: "Photographe cadrant avec son boîtier", tone: "#b7c4d0" },
  { id: "1471341971476-ae15ff5dd4ea", theme: "photo", alt: "Studio photo et éclairages", tone: "#3a3a3a" },
  { id: "1516035069371-29a1b244cc32", theme: "photo", alt: "Objectif d'appareil photo", tone: "#2a2a2a" },
  { id: "1490750967868-88aa4486c946", theme: "flowers", alt: "Coquelicots orange sur fond bleu", tone: "#d79a3a" },
  { id: "1487070183336-b863922373d4", theme: "flowers", alt: "Devanture d'une boutique de fleurs", tone: "#c8c0b0" },
  { id: "1526047932273-341f2a7631f9", theme: "flowers", alt: "Cœur de fleurs roses dans les mains", tone: "#e9c4cf" },
  { id: "1455659817273-f96807779a8a", theme: "flowers", alt: "Tournesols", tone: "#d9b43a" },
  { id: "1469371670807-013ccf25f16a", theme: "flowers", alt: "Allée de cérémonie fleurie", tone: "#d8c9c1" },
  { id: "1522748906645-95d8adfd52c7", theme: "flowers", alt: "Branche de cerisier en fleurs", tone: "#e6dfe3" },
  { id: "1517457373958-b7bdd4587205", theme: "seminar", alt: "Public d'une soirée d'entreprise", tone: "#6a5a4a" },
  { id: "1540575467063-178a50c2df87", theme: "seminar", alt: "Auditoire pendant une conférence", tone: "#3a3f4a" },
  { id: "1475721027785-f74eccf877e2", theme: "seminar", alt: "Micro sur scène", tone: "#5a6a5a" },
  { id: "1505373877841-8d25f7d46678", theme: "seminar", alt: "Présentation devant un écran", tone: "#2f3540" },
  { id: "1511578314322-379afb476865", theme: "seminar", alt: "Salle de séminaire préparée", tone: "#d8d4cc" },
  { id: "1531058020387-3be344556be6", theme: "seminar", alt: "Grande salle et public", tone: "#cfcac2" },
  { id: "1521737711867-e3b97375f902", theme: "seminar", alt: "Équipe en atelier autour d'ordinateurs", tone: "#c4bcae" },
  { id: "1476703993599-0035a21b17a9", theme: "family", alt: "Famille sur un canapé", tone: "#d8d0c4" },
  { id: "1511895426328-dc8714191300", theme: "family", alt: "Groupe au coucher du soleil", tone: "#d89a5a" },
  { id: "1543342384-1f1350e27861", theme: "family", alt: "Père tenant un nouveau-né", tone: "#c9cfd6" },
  { id: "1484665754804-74b091211472", theme: "family", alt: "Enfant porté par sa mère", tone: "#b8c4a8" },
  { id: "1527529482837-4698179dc6ce", theme: "toast", alt: "Invités qui trinquent", tone: "#c9a56a" },
  { id: "1522337660859-02fbefca4702", theme: "beauty", alt: "Pose de vernis", tone: "#e0d6cc" },
  { id: "1562322140-8baeececf3df", theme: "hair", alt: "Coiffeuse au travail", tone: "#dcd6cc" },
  { id: "1560066984-138dadb4c035", theme: "hair", alt: "Salon de coiffure", tone: "#d6d0c8" },
  { id: "1487412947147-5cebf100ffc2", theme: "beauty", alt: "Maquillage de soirée", tone: "#c9a8a0" },
  { id: "1502877338535-766e1452684a", theme: "car", alt: "Voiture de prestige bleue", tone: "#3a6aa8" },
  { id: "1503376780353-7e6692767b70", theme: "car", alt: "Berline noire au crépuscule", tone: "#2a2a2a" },
  { id: "1494976388531-d1058494cdd8", theme: "car", alt: "Voiture de collection", tone: "#4a4a4a" },
  { id: "1424847651672-bf20a4b0982b", theme: "food", alt: "Brunch partagé, plats posés sur la table", tone: "#9c8466" },
  { id: "1429962714451-bb934ecdc4ec", theme: "dj", alt: "Mains en forme de cœur devant la scène", tone: "#5a3a3a" },
  { id: "1459749411175-04bf5292ceea", theme: "dj", alt: "Salle de concert sous les projecteurs jaunes", tone: "#4a3a1a" },
  { id: "1470116892389-0de5d9770b2c", theme: "family", alt: "Chausson de bébé tenu dans la main", tone: "#cfd6e0" },
  { id: "1472653431158-6364773b2a56", theme: "reception", alt: "Invités sous un chapiteau de fête", tone: "#a8b6c4" },
  { id: "1478146059778-26028b07395a", theme: "cake", alt: "Table d'anniversaire : gâteau, fleurs et bouteilles", tone: "#c9b8a8" },
  { id: "1491013516836-7db643ee125a", theme: "kids", alt: "Bébé qui goûte un fruit", tone: "#e6dfe6" },
  { id: "1496843916299-590492c751f4", theme: "balloons", alt: "Ananas déguisés et ballons de fête", tone: "#7fb0d8" },
  { id: "1503919545889-aef636e10ad4", theme: "kids", alt: "Enfant en ciré jaune et sac à dos, dehors", tone: "#8a7a52" },
  { id: "1504196606672-aef5c9cefc92", theme: "balloons", alt: "Grappe de ballons colorés", tone: "#d8a050" },
  { id: "1505236858219-8359eb29e329", theme: "confetti", alt: "Foule et confettis en soirée", tone: "#2f4a7a" },
  { id: "1506157786151-b8491531f063", theme: "dj", alt: "Festival sous les lumières violettes", tone: "#5a2f8a" },
  { id: "1507504031003-b417219a0fde", theme: "wedding", alt: "Panneau « Mr & Mrs » accroché à un arbre", tone: "#c9bda8" },
  { id: "1511632765486-a01980e01a18", theme: "landscape", alt: "Amis enlacés face au coucher du soleil", tone: "#d8a85a" },
  { id: "1511795409834-ef04bbd61622", theme: "reception", alt: "Longue table fleurie dressée pour un banquet", tone: "#c9b88a" },
  { id: "1515934751635-c81c6bc9a2d8", theme: "wedding", alt: "Alliances posées dans des fleurs roses", tone: "#e6d6da" },
  { id: "1516627145497-ae6968895b74", theme: "kids", alt: "Enfant avec un jouet coloré", tone: "#d86a6a" },
  { id: "1517248135467-4c7edcad34c4", theme: "reception", alt: "Salle de restaurant dressée", tone: "#3a3a3a" },
  { id: "1519214605650-76a613ee3245", theme: "dj", alt: "Enseigne néon « Cocktails, dreams, disco, party »", tone: "#1a3aa8" },
  { id: "1519225421980-715cb0215aed", theme: "reception", alt: "Table de mariage fleurie et assiettes blanches", tone: "#d8d4c4" },
  { id: "1519671282429-b44660ead0a7", theme: "toast", alt: "Amis qui partagent un repas", tone: "#b8905a" },
  { id: "1519671482749-fd09be7ccebf", theme: "toast", alt: "Verres de vin qui trinquent", tone: "#6a2f3a" },
  { id: "1522158637959-30385a09e0da", theme: "dj", alt: "Public en lumière devant une scène", tone: "#2a3a4a" },
  { id: "1522413452208-996ff3f3e740", theme: "reception", alt: "Table de dîner ornée de feuillage", tone: "#6a4a2f" },
  { id: "1523301343968-6a6ebf63c672", theme: "terrace", alt: "Soirée au bord d'une piscine, guirlandes lumineuses", tone: "#a8b86a" },
  { id: "1523438885200-e635ba2c371e", theme: "wedding", alt: "Pavillon de cérémonie couvert de roses", tone: "#8aa07a" },
  { id: "1525258946800-98cfd641d0de", theme: "flowers", alt: "Bouquet de roses pêche et blanches", tone: "#e8c8b8" },
  { id: "1528605248644-14dd04022da1", theme: "toast", alt: "Convives attablés pendant un repas", tone: "#8a7a6a" },
  { id: "1529333166437-7750a6dd5a70", theme: "toast", alt: "Amis qui lèvent les bras sur un toit", tone: "#d88a5a" },
  { id: "1530062845289-9109b2c9c868", theme: "food", alt: "Plateaux et salades sur une table de partage", tone: "#b88a5a" },
  { id: "1532712938310-34cb3982ef74", theme: "wedding", alt: "Mariés marchant sur une colline", tone: "#c4b8a8" },
  { id: "1544928147-79a2dbc1f389", theme: "food", alt: "Atelier cuisine autour d'une longue table", tone: "#8a9a6a" },
  { id: "1551218808-94e220e084d2", theme: "food", alt: "Mains qui ciselent des herbes fraîches", tone: "#cfc6b8" },
  { id: "1553915632-175f60dd8e36", theme: "wedding", alt: "Alliances posées sur un dictionnaire", tone: "#d6d2c8" },
  { id: "1558008258-3256797b43f3", theme: "seminar", alt: "Salle plongée dans le bleu devant un écran", tone: "#1a3a6a" },
  { id: "1566737236500-c8ac43014a67", theme: "dj", alt: "Couloir lumineux d'un club en rose et bleu", tone: "#6a1a4a" },
  { id: "1596461404969-9ae70f2830c1", theme: "kids", alt: "Train en bois et jouets sur le tapis", tone: "#b8d8e0" },
];

export type PhotoSize = { w: number; h?: number; q?: number };

/** Unsplash CDN URL with resizing; crop keeps the subject centred. */
export function unsplashUrl(id: string, size: PhotoSize = { w: 1200 }): string {
  const params = new URLSearchParams({ auto: "format", fit: "crop", q: String(size.q ?? 75), w: String(size.w) });
  if (size.h) params.set("h", String(size.h));
  return `https://images.unsplash.com/photo-${id}?${params.toString()}`;
}

export function photosByTheme(theme: PhotoTheme): DemoPhoto[] {
  return DEMO_PHOTOS.filter((p) => p.theme === theme);
}

/** Deterministic pick: same (theme, index) always returns the same photo (stable demo data). */
export function demoPhoto(theme: PhotoTheme, index = 0): DemoPhoto {
  const list = photosByTheme(theme);
  const fallback = DEMO_PHOTOS[0]!;
  if (list.length === 0) return fallback;
  return list[((index % list.length) + list.length) % list.length] ?? fallback;
}

/**
 * Themes a trade may illustrate, in priority order. Strict on purpose: a photo
 * is only ever attached to a trade it truly depicts (no wedding photo for a DJ).
 */
export const CATEGORY_PHOTO_THEMES: Record<string, PhotoTheme[]> = {
  "garde-enfants-evenementielle": ["kids", "family"],
  "baby-sitting": ["family", "kids"],
  "animation-enfants": ["balloons", "confetti", "kids"],
  "wedding-planner": ["wedding", "reception"],
  "domaine-reception": ["venue", "landscape", "terrace"],
  "salle-evenementielle": ["reception", "seminar"],
  traiteur: ["food"],
  patissier: ["cake"],
  photographe: ["photo", "wedding"],
  videaste: ["photo", "wedding"],
  dj: ["dj"],
  musicien: ["dj", "seminar"],
  magicien: ["confetti", "kids"],
  clown: ["balloons", "kids"],
  animateur: ["seminar", "toast"],
  decorateur: ["reception", "flowers"],
  fleuriste: ["flowers"],
  maquilleur: ["beauty"],
  coiffeur: ["hair"],
  "location-materiel": ["reception", "dj"],
  "location-mobilier": ["reception", "terrace"],
  "location-photobooth": ["confetti", "balloons"],
  transport: ["car"],
  hebergement: ["room", "venue"],
};

/** One distinct, exact illustration per trade (category tiles, headers). Ids of the catalogue above. */
export const CATEGORY_COVER_IDS: Record<string, string> = {
  "garde-enfants-evenementielle": "1472162072942-cd5147eb3902",
  "baby-sitting": "1515488042361-ee00e0ddd4e4",
  "animation-enfants": "1503454537195-1dcabb73ffb9",
  "wedding-planner": "1522673607200-164d1b6ce486",
  "domaine-reception": "1571896349842-33c89424de2d",
  "salle-evenementielle": "1519167758481-83f550bb49b3",
  traiteur: "1555244162-803834f70033",
  patissier: "1535254973040-607b474cb50d",
  photographe: "1554048612-b6a482bc67e5",
  videaste: "1471341971476-ae15ff5dd4ea",
  dj: "1470225620780-dba8ba36b745",
  musicien: "1493225457124-a3eb161ffa5f",
  magicien: "1513151233558-d860c5398176",
  clown: "1530103862676-de8c9debad1d",
  animateur: "1475721027785-f74eccf877e2",
  decorateur: "1464366400600-7168b8af9bc3",
  fleuriste: "1487070183336-b863922373d4",
  maquilleur: "1487412947147-5cebf100ffc2",
  coiffeur: "1562322140-8baeececf3df",
  "location-materiel": "1514525253161-7a46d19cd819",
  "location-mobilier": "1559339352-11d035aa65de",
  "location-photobooth": "1492684223066-81342ee5ff30",
  transport: "1503376780353-7e6692767b70",
  hebergement: "1505693416388-ac5ce068fe85",
};

/**
 * Named showcase slots (marketing pages, onboarding, demo event covers). Every id
 * here is reserved: the seed never attaches it to a listing, so a photo shown on
 * a marketing page can never also be the cover of a professional on that page.
 * Within one page the slots used are all distinct.
 */
export const SHOWCASE = {
  heroMain: "1502086223501-7ea6ecd79368",
  heroSecond: "1519741497674-611481863552",
  heroThird: "1527529482837-4698179dc6ce",
  journeyOrganiser: "1511285560929-80b456fea0bc",
  journeyProfessional: "1467003909585-2f8a72700288",
  journeyChildcare: "1476234251651-f353703a034d",
  city0: "1455659817273-f96807779a8a",
  city1: "1490750967868-88aa4486c946",
  city2: "1522748906645-95d8adfd52c7",
  city3: "1464207687429-7505649dae38",
  organiserHero: "1583939003579-730e3918a45a",
  organiserBefore: "1529636798458-92182e662485",
  organiserDuring: "1519225421980-715cb0215aed",
  organiserDay: "1503919545889-aef636e10ad4",
  professionalsHero: "1452587925148-ce544e77e70d",
  directoryA: "1544776193-352d25ca82cd",
  directoryB: "1511795409834-ef04bbd61622",
  directoryC: "1429962714451-bb934ecdc4ec",
  about: "1511895426328-dc8714191300",
  signup: "1543342384-1f1350e27861",
  login: "1465495976277-4387d4b0b4c6",
  intentOrganiser: "1522673607200-164d1b6ce486",
  intentProfessional: "1554048612-b6a482bc67e5",
  eventWedding: "1465495976277-4387d4b0b4c6",
  eventBaptism: "1470116892389-0de5d9770b2c",
  eventSeminar: "1540575467063-178a50c2df87",
} as const;
export type ShowcaseSlot = keyof typeof SHOWCASE;

/** Photo of a named showcase slot. */
export function showcasePhoto(slot: ShowcaseSlot): DemoPhoto {
  const id = SHOWCASE[slot];
  return DEMO_PHOTOS.find((p) => p.id === id) ?? DEMO_PHOTOS[0]!;
}

/** Photos never attached to a listing (showcase slots + one exact photo per trade). */
export const RESERVED_PHOTO_IDS: ReadonlySet<string> = new Set([...Object.values(SHOWCASE), ...Object.values(CATEGORY_COVER_IDS)]);

export const EVENT_PHOTO_THEMES: Record<string, PhotoTheme[]> = {
  wedding: ["wedding", "reception", "flowers"],
  baptism: ["family", "cake", "flowers"],
  birthday: ["balloons", "cake", "confetti"],
  seminar: ["seminar"],
  corporate: ["seminar", "toast"],
  family_gathering: ["family", "toast"],
  other: ["confetti", "reception"],
};

export function categoryPhoto(categorySlug: string, index = 0): DemoPhoto {
  const coverId = CATEGORY_COVER_IDS[categorySlug];
  const cover = coverId ? DEMO_PHOTOS.find((p) => p.id === coverId) : undefined;
  if (index === 0 && cover) return cover;
  const themes = CATEGORY_PHOTO_THEMES[categorySlug] ?? ["reception"];
  const pool = themes.flatMap((t) => photosByTheme(t)).filter((p) => p.id !== cover?.id);
  if (pool.length === 0) return cover ?? DEMO_PHOTOS[0]!;
  return pool[(Math.max(index, 1) - 1) % pool.length]!;
}

export function eventPhoto(eventType: string, index = 0): DemoPhoto {
  const themes = EVENT_PHOTO_THEMES[eventType] ?? ["confetti"];
  const theme = themes[index % themes.length] ?? "confetti";
  return demoPhoto(theme, Math.floor(index / themes.length));
}
