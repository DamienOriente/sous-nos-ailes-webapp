import type { EventType } from "@/modules/events/domain/event-types";

/**
 * Concrete examples shown inside the creation forms (placeholders, chips).
 * Everything here is indicative and generic: no real provider, no quoted
 * price presented as a fact. The chips create real rows through the services.
 */

// ── Planning: classic moments per event type ────────────────────────────────
export type MilestoneTemplate = { title: string; start: string; end?: string; location?: string; description?: string; categorySlugs: string[] };

export const MILESTONE_TEMPLATES: Record<EventType, MilestoneTemplate[]> = {
  wedding: [
    { title: "Arrivée des prestataires et installation", start: "10:00", end: "14:00", location: "Accès livraisons", categorySlugs: ["traiteur", "domaine-reception", "dj", "fleuriste", "decorateur"] },
    { title: "Préparatifs des mariés", start: "12:00", end: "14:30", categorySlugs: ["photographe", "videaste", "coiffeur", "maquilleur"] },
    { title: "Accueil des enfants à l'espace dédié", start: "14:30", end: "15:00", description: "Pointage à l'arrivée, remise des consignes des parents.", categorySlugs: ["garde-enfants-evenementielle", "animation-enfants"] },
    { title: "Cérémonie", start: "15:00", end: "16:00", categorySlugs: ["photographe", "videaste", "dj", "musicien"] },
    { title: "Cocktail / vin d'honneur", start: "17:00", end: "19:30", categorySlugs: ["traiteur", "photographe", "dj", "musicien"] },
    { title: "Dîner", start: "20:00", end: "22:30", categorySlugs: ["traiteur", "photographe"] },
    { title: "Pièce montée", start: "23:00", end: "23:30", categorySlugs: ["traiteur", "patissier", "photographe", "dj"] },
    { title: "Ouverture de bal", start: "23:30", end: "00:00", categorySlugs: ["dj", "musicien", "photographe", "videaste"] },
  ],
  baptism: [
    { title: "Cérémonie", start: "11:00", end: "12:00", categorySlugs: ["photographe"] },
    { title: "Accueil des invités", start: "12:15", end: "12:45", categorySlugs: ["traiteur"] },
    { title: "Déjeuner", start: "12:45", end: "15:00", categorySlugs: ["traiteur"] },
    { title: "Animation des enfants", start: "14:00", end: "17:00", categorySlugs: ["animation-enfants", "garde-enfants-evenementielle"] },
    { title: "Gâteau", start: "16:00", end: "16:30", categorySlugs: ["patissier", "traiteur", "photographe"] },
  ],
  birthday: [
    { title: "Installation et décoration", start: "13:00", end: "14:30", categorySlugs: ["decorateur", "location-materiel"] },
    { title: "Arrivée des invités", start: "15:00", end: "15:30", categorySlugs: [] },
    { title: "Animation", start: "15:30", end: "17:00", categorySlugs: ["animation-enfants", "magicien", "clown", "animateur"] },
    { title: "Gâteau et bougies", start: "17:00", end: "17:30", categorySlugs: ["patissier", "photographe"] },
    { title: "Jeux libres et départ", start: "17:30", end: "18:30", categorySlugs: ["animation-enfants"] },
  ],
  seminar: [
    { title: "Accueil café", start: "08:30", end: "09:00", categorySlugs: ["traiteur"] },
    { title: "Plénière d'ouverture", start: "09:00", end: "10:30", categorySlugs: ["location-materiel"] },
    { title: "Ateliers", start: "10:45", end: "12:30", categorySlugs: ["animateur"] },
    { title: "Déjeuner", start: "12:30", end: "14:00", categorySlugs: ["traiteur"] },
    { title: "Activité de cohésion", start: "14:30", end: "17:30", categorySlugs: ["animateur"] },
    { title: "Dîner", start: "19:30", end: "22:00", categorySlugs: ["traiteur", "dj"] },
  ],
  corporate: [
    { title: "Installation technique", start: "14:00", end: "17:00", categorySlugs: ["location-materiel", "dj"] },
    { title: "Accueil des invités", start: "18:30", end: "19:00", categorySlugs: ["traiteur"] },
    { title: "Prise de parole", start: "19:00", end: "19:30", categorySlugs: ["location-materiel", "photographe"] },
    { title: "Cocktail dînatoire", start: "19:30", end: "22:00", categorySlugs: ["traiteur", "photographe"] },
    { title: "Animation et soirée", start: "22:00", end: "00:00", categorySlugs: ["dj", "animateur", "location-photobooth"] },
  ],
  family_gathering: [
    { title: "Arrivée et installation", start: "11:00", end: "12:00", categorySlugs: [] },
    { title: "Repas", start: "12:30", end: "15:00", categorySlugs: ["traiteur"] },
    { title: "Jeux pour les enfants", start: "15:00", end: "17:00", categorySlugs: ["animation-enfants", "garde-enfants-evenementielle"] },
    { title: "Photo de famille", start: "17:00", end: "17:30", categorySlugs: ["photographe"] },
    { title: "Goûter et départ", start: "17:30", end: "18:30", categorySlugs: ["patissier", "traiteur"] },
  ],
  other: [
    { title: "Installation", start: "09:00", end: "11:00", categorySlugs: [] },
    { title: "Accueil", start: "11:00", end: "11:30", categorySlugs: [] },
    { title: "Temps fort", start: "11:30", end: "13:00", categorySlugs: [] },
    { title: "Repas", start: "13:00", end: "14:30", categorySlugs: ["traiteur"] },
  ],
};

export function milestoneTemplateLabel(type: EventType): string {
  const n = MILESTONE_TEMPLATES[type].length;
  const what: Record<EventType, string> = { wedding: "d'un mariage", baptism: "d'un baptême", birthday: "d'un anniversaire", seminar: "d'un séminaire", corporate: "d'une soirée d'entreprise", family_gathering: "d'une réunion de famille", other: "d'un évènement" };
  return `Ajouter les ${n} moments classiques ${what[type]}`;
}

// ── Budget: indicative template computed from the event ─────────────────────
export type BudgetTemplateInput = {
  type: EventType;
  expectedGuests: number | null;
  expectedChildren: number | null;
  /** Provider slots already in the workspace: their category drives the lines, a known quote replaces the estimate. */
  slots: ReadonlyArray<{ id: string; categorySlug: string | null; categoryName: string | null; quoteCents: number | null; status: string }>;
  /** Lines that already exist (same category → skipped). */
  existingCategories: ReadonlySet<string>;
};
export type BudgetTemplateLine = { category: string; label: string; plannedCents: number; eventProfessionalId: string | null };

/** Indicative unit costs (cents). per = per guest, perChild = per child, flat = whole event. Orders of magnitude, nothing more. */
const CATEGORY_RATES: Record<string, { category: string; label: string; per?: number; perChild?: number; flat?: number }> = {
  "domaine-reception": { category: "Lieu", label: "Location du lieu", flat: 600_000 },
  "salle-evenementielle": { category: "Lieu", label: "Location de la salle", flat: 200_000 },
  traiteur: { category: "Traiteur", label: "Repas et boissons", per: 9_500 },
  patissier: { category: "Traiteur", label: "Gâteau / pièce montée", per: 700 },
  "garde-enfants-evenementielle": { category: "Enfants", label: "Garde d'enfants", perChild: 7_000, flat: 15_000 },
  "baby-sitting": { category: "Enfants", label: "Baby-sitting", perChild: 5_000 },
  "animation-enfants": { category: "Enfants", label: "Animation des enfants", flat: 45_000 },
  photographe: { category: "Photo & vidéo", label: "Reportage photo", flat: 220_000 },
  videaste: { category: "Photo & vidéo", label: "Film de l'évènement", flat: 200_000 },
  dj: { category: "Musique", label: "DJ et sonorisation", flat: 150_000 },
  musicien: { category: "Musique", label: "Musiciens", flat: 120_000 },
  fleuriste: { category: "Décoration", label: "Fleurs", per: 1_500, flat: 40_000 },
  decorateur: { category: "Décoration", label: "Décoration", flat: 120_000 },
  "wedding-planner": { category: "Organisation", label: "Wedding planner", flat: 300_000 },
  animateur: { category: "Animation", label: "Animation", flat: 90_000 },
  magicien: { category: "Animation", label: "Spectacle de magie", flat: 60_000 },
  clown: { category: "Animation", label: "Clown", flat: 40_000 },
  "location-materiel": { category: "Matériel", label: "Location de matériel", flat: 80_000 },
  "location-mobilier": { category: "Matériel", label: "Mobilier", per: 1_200 },
  "location-photobooth": { category: "Animation", label: "Photobooth", flat: 60_000 },
  transport: { category: "Logistique", label: "Transport", flat: 60_000 },
  hebergement: { category: "Logistique", label: "Hébergement", flat: 80_000 },
  coiffeur: { category: "Beauté", label: "Coiffure", flat: 25_000 },
  maquilleur: { category: "Beauté", label: "Maquillage", flat: 20_000 },
};

/** Posts without a provider slot that most events need anyway. */
const BASE_LINES: Record<EventType, Array<{ category: string; label: string; per?: number; flat?: number }>> = {
  wedding: [
    { category: "Papeterie", label: "Faire-part et menus", per: 400 },
    { category: "Tenues", label: "Tenues et alliances", flat: 250_000 },
    { category: "Divers", label: "Imprévus (5 %)", flat: 100_000 },
  ],
  baptism: [
    { category: "Cadeaux", label: "Dragées et souvenirs", per: 500 },
    { category: "Divers", label: "Imprévus", flat: 20_000 },
  ],
  birthday: [
    { category: "Décoration", label: "Ballons et déco", flat: 8_000 },
    { category: "Divers", label: "Cadeaux invités", per: 300 },
  ],
  seminar: [
    { category: "Communication", label: "Supports et goodies", per: 1_500 },
    { category: "Divers", label: "Imprévus", flat: 50_000 },
  ],
  corporate: [
    { category: "Communication", label: "Invitations et signalétique", flat: 40_000 },
    { category: "Divers", label: "Imprévus", flat: 50_000 },
  ],
  family_gathering: [{ category: "Divers", label: "Courses et imprévus", per: 800 }],
  other: [{ category: "Divers", label: "Imprévus", flat: 30_000 }],
};

function roundToHundred(cents: number): number {
  return Math.max(0, Math.round(cents / 10_000) * 10_000);
}

export function buildBudgetTemplate(input: BudgetTemplateInput): BudgetTemplateLine[] {
  const guests = input.expectedGuests ?? 50;
  const children = input.expectedChildren ?? 0;
  const out: BudgetTemplateLine[] = [];
  const seen = new Set<string>(input.existingCategories);
  for (const slot of input.slots) {
    if (!slot.categorySlug || slot.status === "cancelled" || slot.status === "declined") continue;
    const rate = CATEGORY_RATES[slot.categorySlug];
    const category = rate?.category ?? slot.categoryName ?? "Prestataires";
    const key = `${category}:${rate?.label ?? slot.categoryName ?? slot.categorySlug}`;
    if (seen.has(key) || seen.has(category)) continue;
    seen.add(key);
    const estimate = rate ? (rate.flat ?? 0) + (rate.per ?? 0) * guests + (rate.perChild ?? 0) * children : 50_000;
    out.push({ category, label: rate?.label ?? slot.categoryName ?? "Prestation", plannedCents: slot.quoteCents ?? roundToHundred(estimate), eventProfessionalId: slot.id });
  }
  for (const base of BASE_LINES[input.type]) {
    if (seen.has(base.category)) continue;
    seen.add(base.category);
    out.push({ category: base.category, label: base.label, plannedCents: roundToHundred((base.flat ?? 0) + (base.per ?? 0) * guests), eventProfessionalId: null });
  }
  return out;
}

export function budgetTemplateLabel(expectedGuests: number | null): string {
  return expectedGuests ? `Budget type pour ${expectedGuests} invités` : "Budget type pour cet évènement";
}

// ── Tasks: section examples + a few extra suggestions ───────────────────────
export const TASK_SECTIONS = ["Lieu", "Prestataires", "Enfants", "Invités", "Budget", "Décoration", "Dernière ligne droite", "Autres"] as const;

export const TASK_EXAMPLES: Record<string, string[]> = {
  Lieu: ["Visiter le lieu avec le traiteur — avant le 12 mars", "Vérifier le plan B en cas de pluie"],
  Prestataires: ["Réserver le traiteur — avant le 12 mars", "Demander trois devis de photographe"],
  Enfants: ["Confirmer le nombre d'enfants au responsable de la garde", "Prévoir deux lits parapluie pour la sieste"],
  Invités: ["Relancer les invités sans réponse", "Imprimer les marque-places"],
  Budget: ["Vérifier les acomptes versés", "Mettre à jour le budget après le devis traiteur"],
  Décoration: ["Choisir les couleurs et la papeterie", "Commander les bougies et les nappes"],
  "Dernière ligne droite": ["Partager le planning du jour J à l'équipe", "Préparer la liste des contacts d'urgence"],
  Autres: ["Réserver l'hébergement des témoins", "Préparer les discours"],
};

/** Quick-add chips: extra tasks organisers often forget, by event type. */
export const TASK_SUGGESTIONS: Record<EventType, Array<{ title: string; section: string; dueDaysBefore: number | null }>> = {
  wedding: [
    { title: "Faire goûter le menu au traiteur (dégustation)", section: "Prestataires", dueDaysBefore: 120 },
    { title: "Choisir la musique d'entrée et d'ouverture de bal", section: "Prestataires", dueDaysBefore: 45 },
    { title: "Préparer le kit de survie des enfants (jeux, couches, doudous)", section: "Enfants", dueDaysBefore: 10 },
    { title: "Réserver l'hébergement des invités venant de loin", section: "Invités", dueDaysBefore: 90 },
    { title: "Prévoir le plan B en cas de pluie", section: "Lieu", dueDaysBefore: 30 },
  ],
  baptism: [
    { title: "Choisir le parrain et la marraine et les prévenir", section: "Invités", dueDaysBefore: 120 },
    { title: "Commander les dragées", section: "Prestataires", dueDaysBefore: 30 },
    { title: "Prévoir un coin change et sieste", section: "Enfants", dueDaysBefore: 14 },
  ],
  birthday: [
    { title: "Préparer les cartons d'invitation avec l'enfant", section: "Invités", dueDaysBefore: 30 },
    { title: "Prévoir un gâteau sans allergènes", section: "Prestataires", dueDaysBefore: 10 },
    { title: "Préparer la playlist", section: "Autres", dueDaysBefore: 7 },
  ],
  seminar: [
    { title: "Recueillir les contraintes alimentaires des participants", section: "Prestataires", dueDaysBefore: 21 },
    { title: "Tester la visioconférence et le matériel", section: "Lieu", dueDaysBefore: 7 },
    { title: "Préparer les badges et la liste d'émargement", section: "Participants", dueDaysBefore: 5 },
  ],
  corporate: [
    { title: "Valider le discours d'ouverture", section: "Autres", dueDaysBefore: 14 },
    { title: "Prévoir le vestiaire et l'accueil", section: "Lieu", dueDaysBefore: 10 },
  ],
  family_gathering: [
    { title: "Organiser le covoiturage", section: "Invités", dueDaysBefore: 14 },
    { title: "Prévoir les jeux pour les enfants", section: "Enfants", dueDaysBefore: 7 },
  ],
  other: [{ title: "Lister le matériel à apporter", section: "Autres", dueDaysBefore: 7 }],
};

// ── Messaging ───────────────────────────────────────────────────────────────
export const MESSAGE_PLACEHOLDERS: Record<string, string> = {
  general: "Par exemple : « Bienvenue à tous ! Le planning du jour J est dans l'onglet Planning. »",
  coordination: "Par exemple : « @Hélène, le portail livraisons est bien ouvert dès 9h samedi ? »",
  topic: "Par exemple : « Les enfants goûtent à 16h30 : qui prépare les assiettes sans fruits à coque ? »",
  direct: "Écrire un message… Utilisez @Prénom pour mentionner quelqu'un.",
};

export const CHANNEL_EXAMPLES: Array<{ name: string; description: string }> = [
  { name: "Logistique lieu & traiteur", description: "Accès, horaires de livraison, cuisine, plan de salle." },
  { name: "Espace enfants", description: "Effectifs, activités, consignes des parents." },
  { name: "Musique & moments clés", description: "Entrée, ouverture de bal, discours : qui lance quoi et quand." },
  { name: "Photos & vidéo", description: "Liste des photos de groupe, lieux de shooting, autorisations." },
];
