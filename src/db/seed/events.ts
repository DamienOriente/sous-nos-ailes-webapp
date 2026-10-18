import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  auditLogs,
  calendarEntries,
  checklistTemplates,
  eventBudgetLines,
  eventDocuments,
  eventExpenses,
  eventMembers,
  eventMilestones,
  eventPermissions,
  eventProfessionals,
  eventTaskComments,
  eventTasks,
  events,
} from "@/db/schema";
import type { EventRole } from "@/modules/authorization";
import { zonedDateTimeToUtc } from "@/modules/events/application/event-service";
import { buildChecklist } from "@/modules/events/domain/checklist";
import { defaultCoverPhotoId } from "@/modules/events/domain/cover";
import { eventPhoto, showcasePhoto } from "@/modules/media/demo-photos";
import { buildDemoPdf, demoActor, slugFileName, uploadDemoFile } from "./_demo-files";
import { legacyDocumentTitle, renameLegacyKeys } from "./_legacy";
import type { SeedContext } from "./context";

/**
 * Demo events: workspace shell, members, provider slots (with quotes and
 * contracts as real PDF files when the file pipeline is available), checklist
 * (template + extra tasks, comments), D-day planning, budget and expenses.
 * Idempotent on business keys: event = (owner, name), task/milestone/document
 * = title, budget line = label, expense = (line, label), comment = (task,
 * author, body). Channels and messages live in collaboration.ts.
 */
type EventSpec = {
  key: string;
  ownerKey: string;
  name: string;
  type: "wedding" | "baptism" | "seminar";
  eventDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  department: string;
  expectedGuests: number;
  expectedChildren: number;
  budgetCents: number;
  description: string;
  preferences: string;
  /** Index in the catalogue of the event type (see eventPhoto). */
  coverIndex: number;
  members: Array<{ userKey: string; role: EventRole; categorySlug?: string; proKey?: string; title?: string }>;
  providers: ProviderSpec[];
  milestones: Array<{ title: string; start: string; end?: string; location?: string; categorySlugs: string[]; description?: string }>;
  budget: Array<{ category: string; label: string; plannedCents: number; providerKey?: string; expenses?: Array<{ label: string; amountCents: number; status: "planned" | "committed" | "paid"; paidAt?: string }> }>;
  /** Template tasks to flag done / in progress (by title). */
  doneTasks: string[];
  inProgressTasks?: string[];
  /** Extra tasks beyond the template, with optional comments. */
  extraTasks?: ExtraTask[];
  /** Comments on template tasks (by title). */
  taskComments?: Array<{ task: string; from: string; body: string; daysAgo: number }>;
  assignments?: Array<{ task: string; userKey: string }>;
  documents?: DocumentSpec[];
  grants?: Array<{ userKey: string; permission: string; byUserKey: string }>;
};
type ProviderSpec = {
  key: string;
  proKey?: string;
  externalName?: string;
  externalEmail?: string;
  externalPhone?: string;
  categorySlug: string;
  status: "shortlisted" | "requested" | "quoted" | "confirmed" | "declined" | "cancelled";
  quoteCents?: number;
  memberUserKey?: string;
  serviceStart?: string;
  serviceEnd?: string;
  notes?: string;
  /** Files generated through the pipeline and linked to the slot. */
  quoteDoc?: { title: string; lines: string[]; visibility?: string };
  contractDoc?: { title: string; lines: string[]; visibility?: string };
};
type ExtraTask = { title: string; section: string; description?: string; dueDaysBefore: number | null; status?: "todo" | "in_progress" | "done"; priority?: "low" | "normal" | "high" | "urgent"; assignee?: string; visibility?: "organizers" | "team"; comments?: Array<{ from: string; body: string; daysAgo: number }> };
type DocumentSpec = { title: string; kind: "contract" | "quote" | "brief" | "plan" | "other"; purpose: "quote" | "contract" | "document"; visibility: string; lines: string[]; providerKey?: string; uploaderKey?: string };

const WEDDING_PROVIDERS: ProviderSpec[] = [
  {
    key: "marie",
    proKey: "marie",
    categorySlug: "garde-enfants-evenementielle",
    status: "confirmed",
    quoteCents: 118_000,
    memberUserKey: "marie",
    serviceStart: "14:30",
    serviceEnd: "01:00",
    notes: "2 encadrantes (Marie + Nora), espace enfants dans la grange. Coin sieste pour les moins de 3 ans.",
    contractDoc: { title: "Contrat garde d'enfants, Les Petits Ailés", lines: ["Évènement : mariage de Louis et Lisa, 12 juin 2027", "Prestation : 2 intervenantes diplômées, 14h30 → 01h00", "Enfants : 14 (2 à 11 ans), coin sieste et goûter inclus", "Montant : 1 180,00 € TTC, acompte 30 % versé", "Assurance RC pro n° (fictif) 2026-DEMO-001"] },
  },
  {
    key: "helene",
    proKey: "helene",
    categorySlug: "domaine-reception",
    status: "confirmed",
    quoteCents: 850_000,
    memberUserKey: "helene",
    serviceStart: "10:00",
    serviceEnd: "02:00",
    notes: "Orangerie + terrasse + grange. Hébergement : 6 chambres au domaine pour les familles proches.",
    contractDoc: { title: "Contrat de location, Domaine des Tilleuls", lines: ["Location du vendredi 11 juin 14h au dimanche 13 juin 12h", "Orangerie (150 pers.), terrasse des platanes, grange aménagée espace enfants", "6 chambres, office traiteur équipé, parking 80 places", "Montant : 8 500,00 € TTC, acompte 30 % versé le 15/09/2026", "Musique extérieure jusqu'à 23h (arrêté municipal)."] },
  },
  {
    key: "julien",
    proKey: "julien",
    categorySlug: "traiteur",
    status: "quoted",
    quoteCents: 1_250_000,
    memberUserKey: "julien",
    serviceStart: "10:00",
    serviceEnd: "01:00",
    notes: "Devis v2 reçu le 3 octobre : option menu enfants ×14 et brunch du dimanche à confirmer avant le 30 octobre.",
    quoteDoc: { title: "Devis traiteur v2, Rossi Traiteur", lines: ["Cocktail champêtre 12 pièces (120 pers.) : 3 360,00 €", "Menu Lavaur (120 couverts) : 10 680,00 €", "Menu enfants (14 couverts) : 252,00 €", "Option brunch du dimanche (60 pers.) : 1 440,00 €", "Total TTC avec options : 12 500,00 €, valable 30 jours"] },
  },
  {
    key: "ines",
    proKey: "ines",
    categorySlug: "photographe",
    status: "confirmed",
    quoteCents: 240_000,
    memberUserKey: "ines",
    serviceStart: "12:00",
    serviceEnd: "00:30",
    notes: "Reportage complet des préparatifs à l'ouverture de bal. Galerie privée sous 6 semaines.",
    contractDoc: { title: "Contrat reportage photo, Inès Garnier", lines: ["Reportage du 12 juin 2027, 12h → 00h30 (12 h de présence)", "Livraison : galerie privée en ligne sous 6 semaines, 600 photos retouchées", "Droit à l'image : diffusion sur le site de la photographe soumise à accord écrit", "Montant : 2 400,00 € TTC, acompte 30 % à la signature"] },
  },
  {
    key: "theo",
    proKey: "theo",
    categorySlug: "dj",
    status: "quoted",
    quoteCents: 165_000,
    memberUserKey: "theo",
    serviceStart: "16:00",
    serviceEnd: "04:00",
    notes: "Devis reçu avec sonorisation de la cérémonie incluse. Brief musical en cours de remplissage.",
    quoteDoc: { title: "Devis DJ & sonorisation, DJ Théo", lines: ["Sonorisation cérémonie (chapelle) + cocktail + soirée jusqu'à 4h", "Système façade 2 × 15\" + 2 caissons, 2 micros HF, éclairage d'ambiance", "Rendez-vous brief musical inclus", "Montant : 1 650,00 € TTC, acompte 30 % à la confirmation"] },
  },
  {
    key: "camille",
    proKey: "camille",
    categorySlug: "wedding-planner",
    status: "confirmed",
    quoteCents: 320_000,
    memberUserKey: "camille",
    notes: "Coordination complète : prestataires, planning, jour J.",
    contractDoc: { title: "Contrat de coordination, Camille Ferrand", lines: ["Mission : coordination complète du mariage du 12 juin 2027", "Suivi des prestataires, planning du jour J, présence de 9h à 2h", "Honoraires : 3 200,00 € TTC en trois versements (1/3 à la signature)", "Accès aux fiches enfants : limité aux informations utiles, accordé par les mariés"] },
  },
  {
    key: "fleurs",
    externalName: "Fleurs & Co",
    externalEmail: "contact@fleurs-and-co.test",
    externalPhone: "05 61 00 00 00",
    categorySlug: "fleuriste",
    status: "quoted",
    quoteCents: 230_000,
    serviceStart: "09:00",
    serviceEnd: "13:00",
    notes: "Recommandée par Hélène. Bouquet de mariée, arche de cérémonie, 12 centres de table.",
    quoteDoc: { title: "Devis fleurs, Fleurs & Co", lines: ["Bouquet de mariée et boutonnières : 320,00 €", "Arche de cérémonie fleurie (eucalyptus, pivoines, roses) : 650,00 €", "12 centres de table + chemin de table : 1 080,00 €", "Installation sur place le 12 juin 9h : 250,00 €", "Total TTC : 2 300,00 €"] },
  },
  {
    key: "patissier",
    externalName: "Maison Barreau Pâtisserie",
    externalEmail: "lucie@barreau-patisserie.test",
    externalPhone: "05 61 00 00 02",
    categorySlug: "patissier",
    status: "confirmed",
    quoteCents: 68_000,
    serviceStart: "22:30",
    serviceEnd: "23:30",
    notes: "Pièce montée 120 parts (choux vanille/caramel) + 12 parts sans gluten. Livraison 22h30, présentation 23h.",
  },
  {
    key: "beaute",
    externalName: "Atelier Beauté Lavaur",
    externalEmail: "bonjour@atelier-beaute-lavaur.test",
    categorySlug: "maquilleur",
    status: "requested",
    quoteCents: 45_000,
    serviceStart: "11:00",
    serviceEnd: "14:00",
    notes: "Essai coiffure-maquillage prévu le 24 avril. Demande envoyée pour 3 personnes (Lisa + 2 témoins).",
  },
  {
    key: "deco",
    externalName: "LocDéco Occitanie",
    externalEmail: "hello@locdeco.test",
    categorySlug: "location-mobilier",
    status: "confirmed",
    quoteCents: 92_000,
    serviceStart: "14:00",
    serviceEnd: "18:00",
    notes: "Livraison vendredi 14h : 12 tables rondes de 10, 120 chaises bois, mobilier lounge terrasse. Reprise dimanche 12h.",
  },
];

const WEDDING_EXTRA_TASKS: ExtraTask[] = [
  { title: "Faire goûter le menu au traiteur (dégustation)", section: "Prestataires", description: "Dégustation chez Rossi Traiteur à Albi : valider le menu Lavaur et l'alternative végétarienne.", dueDaysBefore: 120, status: "done", assignee: "lisa", comments: [{ from: "lisa", body: "Dégustation faite le 3 octobre : on part sur le filet de bœuf et les ravioles. L'option végétarienne (risotto) est validée pour 10 personnes.", daysAgo: 12 }, { from: "camille", body: "Je transmets à Julien et je demande le devis v2 avec le menu enfants.", daysAgo: 11 }] },
  { title: "Valider le devis v2 du traiteur (menu enfants + brunch)", section: "Prestataires", description: "Réponse attendue par Julien avant le 30 octobre pour bloquer la date.", dueDaysBefore: 225, status: "in_progress", priority: "high", assignee: "louis", comments: [{ from: "julien", body: "Le devis v2 est en ligne dans les documents. Le brunch du dimanche est en option, vous pouvez le retirer sans surcoût.", daysAgo: 9 }, { from: "louis", body: "On regarde ça ce week-end avec Lisa, réponse lundi.", daysAgo: 8 }] },
  { title: "Choisir la musique d'entrée et d'ouverture de bal", section: "Prestataires", description: "À renseigner dans le brief musical (onglet Brief musical) : Théo propose un enchaînement sur September pour lancer la piste.", dueDaysBefore: 45, priority: "normal", assignee: "lisa", comments: [{ from: "theo", body: "Dites-moi si vous préférez une version acoustique pour l'entrée de cérémonie, j'ai deux pistes à vous proposer.", daysAgo: 20 }] },
  { title: "Confirmer la pièce montée (120 parts + 12 sans gluten)", section: "Prestataires", dueDaysBefore: 60, status: "done", assignee: "camille" },
  { title: "Essai coiffure et maquillage", section: "Prestataires", description: "Atelier Beauté Lavaur, le 24 avril à 10h, avec les deux témoins.", dueDaysBefore: 49, assignee: "lisa" },
  { title: "Prévoir le plan B en cas de pluie (cérémonie dans l'orangerie)", section: "Lieu", description: "Hélène peut basculer la cérémonie dans l'orangerie en 45 min ; à prévoir : qui déplace les chaises ?", dueDaysBefore: 30, priority: "high", assignee: "camille", comments: [{ from: "helene", body: "En cas de pluie annoncée la veille, mon équipe installe 120 chaises dans l'orangerie dès 8h. Il faudra juste décaler le dressage des tables à 12h.", daysAgo: 30 }, { from: "camille", body: "Parfait, je l'ajoute au planning de repli. Julien, ça te laisse assez de temps pour dresser ?", daysAgo: 29 }, { from: "julien", body: "Oui si l'orangerie est libre à 12h précises. Au-delà on dresse pendant la cérémonie, c'est jouable.", daysAgo: 29 }] },
  { title: "Visiter le domaine avec le traiteur et le DJ", section: "Lieu", description: "Repérage technique : prises 32A, accès livraisons, régie.", dueDaysBefore: 150, status: "done", assignee: "camille", comments: [{ from: "camille", body: "Visite faite : 2 × 32A dans l'office, régie DJ possible à droite de la piste. Compte rendu dans Documents.", daysAgo: 40 }] },
  { title: "Réserver l'hébergement des invités venant de loin", section: "Invités", description: "6 chambres au domaine (famille proche) + liste de gîtes à Lavaur pour les autres.", dueDaysBefore: 90, status: "in_progress", assignee: "louis" },
  { title: "Préparer le kit de survie des enfants (jeux, couches, doudous)", section: "Enfants", description: "Liste fournie par Marie : coloriages, Kapla, 2 lits parapluie (Hélène), trousse de secours.", dueDaysBefore: 10, assignee: "marie", visibility: "team", comments: [{ from: "marie", body: "J'apporte la malle d'activités et la trousse. Il me manque seulement 2 lits parapluie : Hélène les prête ?", daysAgo: 15 }, { from: "helene", body: "Oui, deux lits parapluie et des matelas de sieste sont au domaine. Je les mets dans la grange le vendredi.", daysAgo: 15 }] },
  { title: "Recueillir les autorisations de récupération pour chaque enfant", section: "Enfants", description: "Formulaire envoyé aux parents : 11 reçus sur 14.", dueDaysBefore: 14, status: "in_progress", assignee: "lisa", comments: [{ from: "lisa", body: "Encore 3 familles à relancer : Perrin, Costa et Fontaine.", daysAgo: 5 }] },
  { title: "Choisir les couleurs et la papeterie (menus, marque-places)", section: "Décoration", dueDaysBefore: 100, status: "done", assignee: "lisa" },
  { title: "Commander les menus imprimés et les marque-places", section: "Décoration", description: "Studio Papier, même papier que les faire-part (vert sauge).", dueDaysBefore: 30, assignee: "lisa" },
  { title: "Rédiger les discours (témoins + parents)", section: "Autres", description: "Maxime (témoin) parle au cocktail, les parents au dîner. Durée max 5 min chacun !", dueDaysBefore: 21, priority: "low" },
  { title: "Organiser les navettes retour (Lavaur → Toulouse)", section: "Invités", description: "Deux départs : 1h et 3h. Devis bus à demander.", dueDaysBefore: 60, assignee: "louis", comments: [{ from: "louis", body: "Devis demandé à deux compagnies, réponse sous 10 jours.", daysAgo: 3 }] },
];

const WEDDING_TASK_COMMENTS: EventSpec["taskComments"] = [
  { task: "Réserver le DJ ou les musiciens", from: "camille", body: "Théo a envoyé son devis avec la sono de la cérémonie incluse : c'est le bon plan, on confirme ?", daysAgo: 18 },
  { task: "Réserver le DJ ou les musiciens", from: "louis", body: "Oui pour moi. Lisa valide ce soir et on passe en confirmé.", daysAgo: 17 },
  { task: "Choisir le fleuriste et la décoration", from: "helene", body: "Fleurs & Co connaît bien le domaine, elles ont fait l'arche l'an dernier au même endroit.", daysAgo: 35 },
  { task: "Envoyer les invitations", from: "lisa", body: "25 invitations parties le 27 septembre, déjà 13 réponses. Les relances automatiques sont programmées.", daysAgo: 16 },
  { task: "Vérifier les acomptes versés", from: "louis", body: "Acomptes domaine, traiteur, garde et planner réglés. Reste le photographe (72 €) à virer cette semaine.", daysAgo: 6 },
  { task: "Inscrire les enfants et recueillir les consignes des parents", from: "marie", body: "9 fiches complètes sur 14. Merci de rappeler aux parents que les infos de santé ne sont lues qu'avec leur accord.", daysAgo: 7 },
  { task: "Finaliser le plan de table", from: "camille", body: "10 tables placées sur le plan, 44 invités installés. Il reste surtout les « peut-être » à trancher.", daysAgo: 2 },
];

const WEDDING_DOCUMENTS: DocumentSpec[] = [
  { title: "Plan de l'orangerie et de la terrasse", kind: "plan", purpose: "document", visibility: "team", uploaderKey: "camille", lines: ["Orangerie : 24 m × 12 m, 12 tables rondes de 10, piste 6 × 6 m au centre", "Terrasse des platanes : 200 m², accès direct office", "Grange : espace enfants 60 m², coin sieste au fond", "Prises : 2 × 32A office, 6 × 16A orangerie, 4 × 16A terrasse"] },
  { title: "Compte rendu de la visite technique du 8 septembre", kind: "brief", purpose: "document", visibility: "organizers", uploaderKey: "camille", lines: ["Présents : Camille, Julien, Théo, Hélène", "Accès livraisons : portail ouest ouvert dès 9h, camions ≤ 12 t", "Régie DJ à droite de la piste, 2 × 16A dédiés", "Plan B pluie : cérémonie dans l'orangerie, installation chaises 8h"] },
  { title: "Programme de l'espace enfants", kind: "brief", purpose: "document", visibility: "team", uploaderKey: "camille", lines: ["14h30 accueil et pointage · 15h chasse au trésor dans le parc", "16h30 goûter (sans fruits à coque) · 18h atelier masques", "19h dîner des enfants · 21h film et coucher des petits", "Remise des enfants : personne autorisée + pièce d'identité"] },
];

const SPECS: EventSpec[] = [
  {
    key: "louisLisa",
    ownerKey: "louis",
    name: "Mariage de Louis et Lisa",
    type: "wedding",
    eventDate: "2027-06-12",
    startTime: "15:00",
    endTime: "23:59",
    venueName: "Domaine des Tilleuls",
    addressLine1: "Chemin des Tilleuls",
    postalCode: "81500",
    city: "Lavaur",
    department: "81",
    expectedGuests: 120,
    expectedChildren: 14,
    budgetCents: 3_500_000,
    description: "Cérémonie laïque dans le parc, cocktail sur la terrasse puis dîner dans l'orangerie. Quatorze enfants de 2 à 11 ans : un espace dédié avec garde professionnelle est prévu.",
    preferences: "Ambiance champêtre et chaleureuse. Menu végétarien pour une dizaine d'invités. Pas de feu d'artifice (voisinage).",
    coverIndex: 3,
    members: [
      { userKey: "louis", role: "owner" },
      { userKey: "lisa", role: "co_organizer" },
      { userKey: "camille", role: "wedding_planner", categorySlug: "wedding-planner", proKey: "camille" },
      { userKey: "marie", role: "provider", categorySlug: "garde-enfants-evenementielle", proKey: "marie", title: "Responsable espace enfants" },
      { userKey: "nora", role: "staff", categorySlug: "garde-enfants-evenementielle", title: "Renfort espace enfants" },
      { userKey: "julien", role: "provider", categorySlug: "traiteur", proKey: "julien" },
      { userKey: "helene", role: "provider", categorySlug: "domaine-reception", proKey: "helene" },
      { userKey: "theo", role: "provider", categorySlug: "dj", proKey: "theo" },
      { userKey: "ines", role: "provider", categorySlug: "photographe", proKey: "ines" },
    ],
    providers: WEDDING_PROVIDERS,
    milestones: [
      { title: "Arrivée des prestataires & installation", start: "10:00", end: "14:00", location: "Domaine, accès livraisons", categorySlugs: ["traiteur", "domaine-reception", "dj", "fleuriste", "location-mobilier"], description: "Fleuriste 9h, traiteur 10h, DJ 16h. Portail ouest." },
      { title: "Préparatifs de Lisa et de Louis", start: "12:00", end: "14:30", location: "Suite du domaine / gîte", categorySlugs: ["photographe", "maquilleur", "coiffeur"] },
      { title: "Accueil des enfants à l'espace dédié", start: "14:30", end: "15:00", location: "La grange", categorySlugs: ["garde-enfants-evenementielle"], description: "Pointage à l'arrivée, remise des consignes des parents." },
      { title: "Cérémonie laïque", start: "15:00", end: "16:00", location: "Le parc", categorySlugs: ["photographe", "dj"] },
      { title: "Sortie de cérémonie et photos de groupe", start: "16:00", end: "16:45", location: "Escalier de l'orangerie", categorySlugs: ["photographe"] },
      { title: "Goûter des enfants", start: "16:30", end: "17:15", location: "La grange", categorySlugs: ["garde-enfants-evenementielle", "traiteur"], description: "Sans fruits à coque." },
      { title: "Cocktail", start: "17:00", end: "19:30", location: "Terrasse des platanes", categorySlugs: ["traiteur", "photographe", "dj"] },
      { title: "Dîner des enfants", start: "19:00", end: "20:00", location: "La grange", categorySlugs: ["garde-enfants-evenementielle", "traiteur"] },
      { title: "Dîner", start: "20:00", end: "22:30", location: "Orangerie", categorySlugs: ["traiteur", "photographe"] },
      { title: "Photos de couple au coucher du soleil", start: "21:15", end: "21:45", location: "Allée de platanes", categorySlugs: ["photographe"] },
      { title: "Coucher des petits (espace sieste)", start: "21:30", location: "La grange, coin calme", categorySlugs: ["garde-enfants-evenementielle"] },
      { title: "Pièce montée", start: "23:00", end: "23:30", location: "Orangerie", categorySlugs: ["traiteur", "patissier", "photographe", "dj"] },
      { title: "Ouverture de bal", start: "23:30", end: "00:00", location: "Orangerie", categorySlugs: ["dj", "photographe"], description: "Perfect (Ed Sheeran) puis September pour lancer la piste." },
    ],
    budget: [
      { category: "Lieu", label: "Location du domaine", plannedCents: 900_000, providerKey: "helene", expenses: [{ label: "Acompte domaine (30 %)", amountCents: 255_000, status: "paid", paidAt: "2026-09-15" }, { label: "Solde domaine", amountCents: 595_000, status: "committed" }] },
      { category: "Traiteur", label: "Cocktail + dîner 120 couverts", plannedCents: 1_200_000, providerKey: "julien", expenses: [{ label: "Acompte traiteur", amountCents: 375_000, status: "paid", paidAt: "2026-10-02" }] },
      { category: "Traiteur", label: "Pièce montée", plannedCents: 70_000, providerKey: "patissier", expenses: [{ label: "Acompte pâtissier", amountCents: 20_000, status: "paid", paidAt: "2026-10-05" }] },
      { category: "Enfants", label: "Garde d'enfants (2 encadrantes)", plannedCents: 120_000, providerKey: "marie", expenses: [{ label: "Acompte garde d'enfants", amountCents: 35_400, status: "paid", paidAt: "2026-10-10" }] },
      { category: "Photo & vidéo", label: "Reportage photo", plannedCents: 250_000, providerKey: "ines", expenses: [{ label: "Acompte photographe", amountCents: 72_000, status: "committed" }] },
      { category: "Musique", label: "DJ + sonorisation", plannedCents: 180_000, providerKey: "theo", expenses: [{ label: "Acompte DJ (à la confirmation)", amountCents: 49_500, status: "planned" }] },
      { category: "Organisation", label: "Wedding planner", plannedCents: 320_000, providerKey: "camille", expenses: [{ label: "Honoraires wedding planner (1/3)", amountCents: 106_700, status: "paid", paidAt: "2026-08-01" }, { label: "Honoraires wedding planner (2/3)", amountCents: 106_700, status: "committed" }] },
      { category: "Décoration", label: "Fleurs", plannedCents: 220_000, providerKey: "fleurs", expenses: [{ label: "Devis fleuriste (estimation)", amountCents: 230_000, status: "committed" }] },
      { category: "Décoration", label: "Mobilier et décoration", plannedCents: 100_000, providerKey: "deco", expenses: [{ label: "Acompte LocDéco", amountCents: 27_600, status: "paid", paidAt: "2026-10-12" }] },
      { category: "Beauté", label: "Coiffure et maquillage", plannedCents: 50_000, providerKey: "beaute" },
      { category: "Divers", label: "Tenues, alliances, papeterie", plannedCents: 330_000, expenses: [{ label: "Faire-part (Studio Papier)", amountCents: 42_000, status: "paid", paidAt: "2026-07-20" }, { label: "Alliances", amountCents: 180_000, status: "paid", paidAt: "2026-09-28" }] },
    ],
    doneTasks: ["Choisir et réserver le lieu de réception", "Réserver le lieu de cérémonie", "Réserver le traiteur", "Réserver le photographe et le vidéaste", "Fixer le budget global et sa répartition", "Estimer le nombre et l'âge des enfants présents", "Réserver une garde d'enfants ou une animation", "Établir la liste des invités", "Envoyer les invitations", "Choisir le fleuriste et la décoration", "Prévoir un espace enfants (coin calme, sieste, jeux)"],
    inProgressTasks: ["Réserver le DJ ou les musiciens", "Inscrire les enfants et recueillir les consignes des parents", "Vérifier les acomptes versés", "Finaliser le plan de table"],
    extraTasks: WEDDING_EXTRA_TASKS,
    taskComments: WEDDING_TASK_COMMENTS,
    assignments: [
      { task: "Réserver le DJ ou les musiciens", userKey: "camille" },
      { task: "Inscrire les enfants et recueillir les consignes des parents", userKey: "lisa" },
      { task: "Définir les personnes autorisées à récupérer chaque enfant", userKey: "marie" },
      { task: "Vérifier les acomptes versés", userKey: "louis" },
      { task: "Relancer les invités sans réponse", userKey: "lisa" },
      { task: "Finaliser le plan de table", userKey: "camille" },
      { task: "Confirmer les horaires avec chaque prestataire", userKey: "camille" },
      { task: "Partager le planning du jour J à l'équipe", userKey: "camille" },
    ],
    documents: WEDDING_DOCUMENTS,
    grants: [{ userKey: "camille", permission: "children.view_sensitive", byUserKey: "louis" }],
  },
  {
    key: "baptemeChloe",
    ownerKey: "paul",
    name: "Baptême de Chloé",
    type: "baptism",
    eventDate: "2027-03-21",
    startTime: "11:00",
    endTime: "18:00",
    venueName: "Salle des fêtes de Caudéran",
    addressLine1: "Rue de la Mairie",
    postalCode: "33200",
    city: "Bordeaux",
    department: "33",
    expectedGuests: 45,
    expectedChildren: 9,
    budgetCents: 450_000,
    description: "Cérémonie à 11h puis déjeuner et après-midi en famille.",
    preferences: "Animation douce pour les enfants l'après-midi.",
    coverIndex: 1,
    members: [
      { userKey: "paul", role: "owner" },
      { userKey: "sofia", role: "provider", categorySlug: "animation-enfants", proKey: "sofia" },
    ],
    providers: [
      { key: "sofia", proKey: "sofia", categorySlug: "animation-enfants", status: "confirmed", quoteCents: 38_000, memberUserKey: "sofia", serviceStart: "14:00", serviceEnd: "17:30", notes: "Maquillage, bulles géantes, petit spectacle à 16h." },
      { key: "traiteur", externalName: "Traiteur Les Quais", externalEmail: "contact@lesquais.test", categorySlug: "traiteur", status: "quoted", quoteCents: 160_000, serviceStart: "12:00", serviceEnd: "16:00", notes: "Buffet froid + plat chaud, menu enfants ×9." },
      { key: "photo", externalName: "Studio Garonne", externalEmail: "hello@studio-garonne.test", categorySlug: "photographe", status: "confirmed", quoteCents: 65_000, serviceStart: "10:30", serviceEnd: "15:00" },
      { key: "gateau", externalName: "Pâtisserie Dupuy", categorySlug: "patissier", status: "requested", quoteCents: 18_000, notes: "Gâteau 45 parts, décor nuages et étoiles." },
    ],
    milestones: [
      { title: "Cérémonie", start: "11:00", end: "12:00", location: "Église Saint-Amand", categorySlugs: ["photographe"] },
      { title: "Accueil et apéritif", start: "12:15", end: "12:45", location: "Salle des fêtes", categorySlugs: ["traiteur"] },
      { title: "Déjeuner", start: "12:45", end: "15:00", location: "Salle des fêtes", categorySlugs: ["traiteur", "photographe"] },
      { title: "Animation enfants", start: "14:00", end: "17:30", location: "Salle annexe", categorySlugs: ["animation-enfants"] },
      { title: "Gâteau", start: "16:00", end: "16:30", location: "Salle des fêtes", categorySlugs: ["patissier", "animation-enfants"] },
    ],
    budget: [
      { category: "Lieu", label: "Salle des fêtes", plannedCents: 60_000, expenses: [{ label: "Location salle", amountCents: 60_000, status: "paid", paidAt: "2026-10-01" }] },
      { category: "Traiteur", label: "Déjeuner 45 couverts", plannedCents: 180_000, providerKey: "traiteur" },
      { category: "Traiteur", label: "Gâteau", plannedCents: 20_000, providerKey: "gateau" },
      { category: "Enfants", label: "Animation", plannedCents: 40_000, providerKey: "sofia", expenses: [{ label: "Acompte animation", amountCents: 11_400, status: "paid", paidAt: "2026-10-12" }] },
      { category: "Photo & vidéo", label: "Photographe", plannedCents: 70_000, providerKey: "photo", expenses: [{ label: "Acompte photographe", amountCents: 19_500, status: "committed" }] },
      { category: "Cadeaux", label: "Dragées et souvenirs", plannedCents: 25_000 },
    ],
    doneTasks: ["Fixer la date avec la paroisse ou la mairie", "Réserver la salle ou le restaurant", "Réserver un photographe"],
    inProgressTasks: ["Choisir le traiteur ou le menu"],
    extraTasks: [
      { title: "Commander les dragées", section: "Prestataires", dueDaysBefore: 30, assignee: "paul" },
      { title: "Prévoir un coin change et sieste", section: "Enfants", dueDaysBefore: 14, status: "done", assignee: "sofia", visibility: "team", comments: [{ from: "sofia", body: "La salle annexe a un coin moquette : parfait pour les petits. J'apporte un tapis d'éveil.", daysAgo: 4 }] },
    ],
    taskComments: [{ task: "Choisir le traiteur ou le menu", from: "paul", body: "Devis Les Quais reçu : 1 600 € pour 45 couverts, menu enfants inclus. Je compare avec un deuxième traiteur avant de décider.", daysAgo: 6 }],
    documents: [{ title: "Devis traiteur, Les Quais", kind: "quote", purpose: "quote", visibility: "organizers", providerKey: "traiteur", lines: ["Buffet froid et plat chaud pour 45 personnes", "Menu enfants ×9", "Montant : 1 600,00 € TTC"] }],
  },
  {
    key: "seminaireDiginumia",
    ownerKey: "paul",
    name: "Séminaire DIGINUMIA",
    type: "seminar",
    eventDate: "2027-01-28",
    startTime: "09:00",
    endTime: "22:00",
    venueName: "Espace Compans",
    addressLine1: "Place Compans",
    postalCode: "31000",
    city: "Toulouse",
    department: "31",
    expectedGuests: 30,
    expectedChildren: 0,
    budgetCents: 900_000,
    description: "Séminaire annuel : ateliers le matin, cohésion l'après-midi, dîner.",
    preferences: "Format participatif, pas de PowerPoint interminable.",
    coverIndex: 4,
    members: [{ userKey: "paul", role: "owner" }],
    providers: [
      { key: "lieu", externalName: "Compans Événements", externalEmail: "resa@compans.test", categorySlug: "salle-evenementielle", status: "confirmed", quoteCents: 250_000, serviceStart: "08:00", serviceEnd: "23:00" },
      { key: "traiteur", externalName: "Table Occitane", externalEmail: "contact@table-occitane.test", categorySlug: "traiteur", status: "quoted", quoteCents: 380_000, serviceStart: "08:30", serviceEnd: "22:00", notes: "Pauses, déjeuner, dîner pour 30 personnes." },
      { key: "anim", externalName: "Cohésion & Co", externalEmail: "bonjour@cohesion-co.test", categorySlug: "animateur", status: "requested", quoteCents: 140_000, serviceStart: "14:30", serviceEnd: "17:30", notes: "Escape game géant en ville." },
      { key: "tech", categorySlug: "location-materiel", status: "shortlisted" },
    ],
    milestones: [
      { title: "Accueil café", start: "09:00", end: "09:30", categorySlugs: ["traiteur"] },
      { title: "Plénière : bilan de l'année", start: "09:30", end: "10:45", categorySlugs: ["location-materiel"] },
      { title: "Ateliers en sous-groupes", start: "11:00", end: "12:30", categorySlugs: [] },
      { title: "Déjeuner", start: "12:30", end: "14:00", categorySlugs: ["traiteur"] },
      { title: "Activité de cohésion", start: "14:30", end: "17:30", categorySlugs: ["animateur"] },
      { title: "Dîner", start: "19:30", end: "22:00", categorySlugs: ["traiteur"] },
    ],
    budget: [
      { category: "Lieu", label: "Salles + plénière", plannedCents: 250_000, providerKey: "lieu", expenses: [{ label: "Réservation salle", amountCents: 250_000, status: "committed" }] },
      { category: "Traiteur", label: "Pauses, déjeuner, dîner", plannedCents: 400_000, providerKey: "traiteur" },
      { category: "Animation", label: "Team building", plannedCents: 150_000, providerKey: "anim" },
      { category: "Matériel", label: "Vidéoprojection et sono", plannedCents: 60_000, providerKey: "tech" },
      { category: "Communication", label: "Supports et goodies", plannedCents: 40_000 },
    ],
    doneTasks: ["Réserver le lieu et les salles de travail"],
    inProgressTasks: ["Choisir le traiteur (pauses, déjeuners, dîner)"],
    extraTasks: [{ title: "Recueillir les contraintes alimentaires des participants", section: "Prestataires", dueDaysBefore: 21, assignee: "paul", comments: [{ from: "paul", body: "Formulaire envoyé à l'équipe, 18 réponses sur 30.", daysAgo: 2 }] }],
  },
];

export async function seed(ctx: SeedContext): Promise<void> {
  const { db, now } = ctx;
  const tz = "Europe/Paris";
  await renameLegacyKeys(ctx);
  for (const spec of SPECS) {
    const ownerId = ctx.users[spec.ownerKey];
    if (!ownerId) throw new Error(`seed events: unknown owner ${spec.ownerKey}`);

    const [existing] = await db.select({ id: events.id, coverPhotoId: events.coverPhotoId }).from(events).where(and(eq(events.ownerUserId, ownerId), eq(events.name, spec.name), eq(events.isDemo, true))).limit(1);
    const startsAt = zonedDateTimeToUtc(spec.eventDate, spec.startTime, tz);
    const endsAt = zonedDateTimeToUtc(spec.eventDate, spec.endTime, tz);
    const coverPhotoId = (spec.type === "wedding" ? showcasePhoto("eventWedding") : spec.type === "baptism" ? showcasePhoto("eventBaptism") : spec.type === "seminar" ? showcasePhoto("eventSeminar") : eventPhoto(spec.type, spec.coverIndex)).id || defaultCoverPhotoId(spec.type, spec.key);
    let eventId: string;
    if (existing) {
      eventId = existing.id;
      await db
        .update(events)
        .set({ type: spec.type, description: spec.description, eventDate: spec.eventDate, startsAt, endsAt, timezone: tz, venueName: spec.venueName, expectedGuests: spec.expectedGuests, expectedChildren: spec.expectedChildren, budgetCents: spec.budgetCents, preferences: spec.preferences, department: spec.department, postalCode: spec.postalCode, coverPhotoId: existing.coverPhotoId ?? coverPhotoId })
        .where(eq(events.id, eventId));
    } else {
      const [event] = await db
        .insert(events)
        .values({
          ownerUserId: ownerId,
          name: spec.name,
          type: spec.type,
          description: spec.description,
          status: "planning",
          eventDate: spec.eventDate,
          startsAt,
          endsAt,
          timezone: tz,
          venueName: spec.venueName,
          addressLine1: spec.addressLine1,
          postalCode: spec.postalCode,
          city: spec.city,
          department: spec.department,
          expectedGuests: spec.expectedGuests,
          expectedChildren: spec.expectedChildren,
          budgetCents: spec.budgetCents,
          preferences: spec.preferences,
          coverPhotoId,
          isDemo: true,
        })
        .returning({ id: events.id });
      if (!event) throw new Error("seed events: insert failed");
      eventId = event.id;
      await db.insert(auditLogs).values({ actorUserId: ownerId, action: "event.created", resourceType: "event", resourceId: eventId, eventId, metadata: { type: spec.type, demo: true } });
    }
    ctx.events[spec.key] = eventId;

    // ── Members ───────────────────────────────────────────────────────────
    const memberIdByUserKey = new Map<string, string>();
    for (const m of spec.members) {
      const userId = ctx.users[m.userKey];
      if (!userId) continue;
      const values = {
        role: m.role,
        status: "active" as const,
        categoryId: m.categorySlug ? (ctx.categories[m.categorySlug] ?? null) : null,
        professionalId: m.proKey ? (ctx.professionals[m.proKey] ?? null) : null,
        title: m.title ?? null,
      };
      const [row] = await db
        .insert(eventMembers)
        .values({ eventId, userId, ...values, invitedByUserId: m.role === "owner" ? null : ownerId, joinedAt: new Date(now.getTime() - 100 * 86_400_000) })
        .onConflictDoUpdate({ target: [eventMembers.eventId, eventMembers.userId], set: values })
        .returning({ id: eventMembers.id });
      if (row) {
        memberIdByUserKey.set(m.userKey, row.id);
        ctx.members[`${spec.key}:${m.userKey}`] = row.id;
      }
    }

    // ── Provider slots (upsert by professional or external name; placeholders by category) ──
    const providerIdByKey = new Map<string, string>();
    const slotRows = await db.select({ id: eventProfessionals.id, professionalId: eventProfessionals.professionalId, externalName: eventProfessionals.externalName, categoryId: eventProfessionals.categoryId }).from(eventProfessionals).where(eq(eventProfessionals.eventId, eventId));
    for (const p of spec.providers) {
      const professionalId = p.proKey ? (ctx.professionals[p.proKey] ?? null) : null;
      const externalName = professionalId ? null : (p.externalName ?? (p.proKey ? demoProName(p.proKey) : null));
      const categoryId = ctx.categories[p.categorySlug] ?? null;
      const found =
        slotRows.find((r) => professionalId && r.professionalId === professionalId) ??
        slotRows.find((r) => externalName && r.externalName === externalName) ??
        (p.proKey ? slotRows.find((r) => r.externalName === demoProName(p.proKey!)) : undefined) ??
        slotRows.find((r) => !r.professionalId && !r.externalName && r.categoryId === categoryId);
      const serviceStartsAt = p.serviceStart ? zonedDateTimeToUtc(spec.eventDate, p.serviceStart, tz) : null;
      const values = {
        professionalId,
        memberId: p.memberUserKey ? (memberIdByUserKey.get(p.memberUserKey) ?? null) : null,
        categoryId,
        externalName,
        externalEmail: p.externalEmail ?? null,
        externalPhone: p.externalPhone ?? null,
        status: p.status,
        quoteCents: p.quoteCents ?? null,
        serviceStartsAt,
        serviceEndsAt: p.serviceEnd ? rollover(zonedDateTimeToUtc(spec.eventDate, p.serviceEnd, tz), serviceStartsAt) : null,
        notes: p.notes ?? null,
      };
      let id: string;
      if (found) {
        id = found.id;
        await db.update(eventProfessionals).set(values).where(eq(eventProfessionals.id, id));
        slotRows.splice(slotRows.indexOf(found), 1);
      } else {
        const [row] = await db.insert(eventProfessionals).values({ eventId, ...values }).returning({ id: eventProfessionals.id });
        if (!row) continue;
        id = row.id;
      }
      providerIdByKey.set(p.key, id);
    }

    // ── Quote / contract files (real pipeline, idempotent by document title) ──
    const existingDocs = await db.select({ title: eventDocuments.title, fileId: eventDocuments.fileId }).from(eventDocuments).where(eq(eventDocuments.eventId, eventId));
    const docFileByTitle = new Map(existingDocs.map((d) => [d.title, d.fileId]));
    const ownerActor = await demoActor(ctx, spec.ownerKey);
    const ensureDoc = async (doc: DocumentSpec & { providerKey?: string }, uploaderKey?: string): Promise<string | null> => {
      const known = docFileByTitle.get(doc.title);
      if (known) return known;
      // A document generated under its pre-2026-10-18 title: regenerate the PDF and re-point the same row.
      const legacyTitle = legacyDocumentTitle(doc.title);
      const legacyKnown = legacyTitle ? docFileByTitle.get(legacyTitle) : undefined;
      const actor = (uploaderKey ? await demoActor(ctx, uploaderKey) : null) ?? ownerActor;
      if (!actor) return null;
      const bytes = await buildDemoPdf(doc.title, doc.lines);
      const fileId = await uploadDemoFile(actor, { scope: "event", scopeId: eventId, purpose: doc.purpose, originalName: slugFileName(doc.title), bytes });
      if (!fileId) return null;
      if (legacyTitle && legacyKnown) {
        await db.update(eventDocuments).set({ title: doc.title, fileId }).where(and(eq(eventDocuments.eventId, eventId), eq(eventDocuments.title, legacyTitle)));
        docFileByTitle.delete(legacyTitle);
      } else {
        await db.insert(eventDocuments).values({ eventId, fileId, title: doc.title, kind: doc.kind, visibility: doc.visibility, eventProfessionalId: doc.providerKey ? (providerIdByKey.get(doc.providerKey) ?? null) : null, uploadedByUserId: actor.userId });
      }
      docFileByTitle.set(doc.title, fileId);
      return fileId;
    };
    for (const p of spec.providers) {
      const slotId = providerIdByKey.get(p.key);
      if (!slotId) continue;
      const patch: { quoteFileId?: string; contractFileId?: string } = {};
      if (p.quoteDoc) {
        const fileId = await ensureDoc({ ...p.quoteDoc, kind: "quote", purpose: "quote", visibility: p.quoteDoc.visibility ?? "organizers", providerKey: p.key });
        if (fileId) patch.quoteFileId = fileId;
      }
      if (p.contractDoc) {
        const fileId = await ensureDoc({ ...p.contractDoc, kind: "contract", purpose: "contract", visibility: p.contractDoc.visibility ?? "organizers", providerKey: p.key });
        if (fileId) patch.contractFileId = fileId;
      }
      if (Object.keys(patch).length) await db.update(eventProfessionals).set(patch).where(eq(eventProfessionals.id, slotId));
    }
    for (const doc of spec.documents ?? []) await ensureDoc(doc, doc.uploaderKey);

    // ── Checklist: template tasks (insert missing), statuses, assignees, extra tasks, comments ──
    const templates = await db.select().from(checklistTemplates).where(and(eq(checklistTemplates.eventType, spec.type), eq(checklistTemplates.isActive, true)));
    const generated = buildChecklist(templates, spec.eventDate);
    const taskRows = await db.select({ id: eventTasks.id, title: eventTasks.title }).from(eventTasks).where(eq(eventTasks.eventId, eventId));
    const taskIdByTitle = new Map(taskRows.map((t) => [t.title, t.id]));
    const missingTemplate = generated.filter((t) => !taskIdByTitle.has(t.title));
    if (missingTemplate.length) {
      const inserted = await db
        .insert(eventTasks)
        .values(missingTemplate.map((t) => ({ eventId, title: t.title, description: t.description, section: t.section, dueDate: t.dueDate, sortOrder: t.sortOrder, visibility: t.visibility, createdByUserId: ownerId })))
        .returning({ id: eventTasks.id, title: eventTasks.title });
      for (const r of inserted) taskIdByTitle.set(r.title, r.id);
    }
    const inProgress = new Set(spec.inProgressTasks ?? []);
    for (const t of generated) {
      const id = taskIdByTitle.get(t.title);
      if (!id) continue;
      const done = spec.doneTasks.includes(t.title);
      const assignment = spec.assignments?.find((a) => a.task === t.title);
      await db
        .update(eventTasks)
        .set({
          status: done ? "done" : inProgress.has(t.title) ? "in_progress" : "todo",
          completedAt: done ? new Date(now.getTime() - 10 * 86_400_000) : null,
          assigneeMemberId: assignment ? (memberIdByUserKey.get(assignment.userKey) ?? null) : t.section === "Enfants" ? (memberIdByUserKey.get("camille") ?? null) : null,
        })
        .where(eq(eventTasks.id, id));
    }
    let extraOrder = 1000;
    for (const x of spec.extraTasks ?? []) {
      let id = taskIdByTitle.get(x.title);
      if (!id) {
        const [row] = await db
          .insert(eventTasks)
          .values({
            eventId,
            title: x.title,
            description: x.description ?? null,
            section: x.section,
            dueDate: x.dueDaysBefore === null ? null : addDaysIso(spec.eventDate, -x.dueDaysBefore),
            status: x.status ?? "todo",
            priority: x.priority ?? "normal",
            completedAt: x.status === "done" ? new Date(now.getTime() - 20 * 86_400_000) : null,
            assigneeMemberId: x.assignee ? (memberIdByUserKey.get(x.assignee) ?? null) : null,
            visibility: x.visibility ?? "organizers",
            sortOrder: extraOrder,
            createdByUserId: x.assignee ? (ctx.users[x.assignee] ?? ownerId) : ownerId,
          })
          .returning({ id: eventTasks.id });
        id = row?.id;
        if (id) taskIdByTitle.set(x.title, id);
      }
      extraOrder += 10;
      if (id) for (const c of x.comments ?? []) await ensureComment(ctx, id, c);
    }
    for (const c of spec.taskComments ?? []) {
      const id = taskIdByTitle.get(c.task);
      if (id) await ensureComment(ctx, id, c);
    }

    // ── Milestones (insert missing titles) ──
    const milestoneRows = await db.select({ title: eventMilestones.title }).from(eventMilestones).where(eq(eventMilestones.eventId, eventId));
    const milestoneTitles = new Set(milestoneRows.map((m) => m.title));
    const newMilestones = spec.milestones.filter((m) => !milestoneTitles.has(m.title));
    if (newMilestones.length) {
      await db.insert(eventMilestones).values(
        newMilestones.map((m) => {
          const s = zonedDateTimeToUtc(spec.eventDate, m.start, tz);
          const e = m.end ? rollover(zonedDateTimeToUtc(spec.eventDate, m.end, tz), s) : null;
          return { eventId, title: m.title, description: m.description ?? null, startsAt: s, endsAt: e, location: m.location ?? null, categorySlugs: m.categorySlugs, sortOrder: spec.milestones.indexOf(m) };
        }),
      );
    }

    // ── Budget lines (by label) + expenses (by label within the line) ──
    const lineRows = await db.select({ id: eventBudgetLines.id, label: eventBudgetLines.label }).from(eventBudgetLines).where(eq(eventBudgetLines.eventId, eventId));
    const lineIdByLabel = new Map(lineRows.map((l) => [l.label, l.id]));
    for (const [i, b] of spec.budget.entries()) {
      const providerId = b.providerKey ? (providerIdByKey.get(b.providerKey) ?? null) : null;
      let lineId = lineIdByLabel.get(b.label);
      if (lineId) {
        await db.update(eventBudgetLines).set({ category: b.category, plannedCents: b.plannedCents, eventProfessionalId: providerId, sortOrder: i }).where(eq(eventBudgetLines.id, lineId));
      } else {
        const [line] = await db.insert(eventBudgetLines).values({ eventId, category: b.category, label: b.label, plannedCents: b.plannedCents, eventProfessionalId: providerId, sortOrder: i }).returning({ id: eventBudgetLines.id });
        lineId = line?.id;
        if (lineId) lineIdByLabel.set(b.label, lineId);
      }
      if (!lineId || !b.expenses?.length) continue;
      const existingExpenses = await db.select({ label: eventExpenses.label }).from(eventExpenses).where(and(eq(eventExpenses.eventId, eventId), eq(eventExpenses.budgetLineId, lineId)));
      const have = new Set(existingExpenses.map((e) => e.label));
      const toInsert = b.expenses.filter((e) => !have.has(e.label));
      if (toInsert.length) await db.insert(eventExpenses).values(toInsert.map((e) => ({ eventId, budgetLineId: lineId!, label: e.label, amountCents: e.amountCents, status: e.status, paidAt: e.paidAt ?? null })));
    }
    // Lines of an older version of the demo (placeholders at 0 € or labels no longer in the spec) are dropped with their expenses.
    const labels = spec.budget.map((b) => b.label);
    const obsolete = lineRows.filter((l) => !labels.includes(l.label)).map((l) => l.id);
    if (obsolete.length) {
      await db.delete(eventExpenses).where(and(eq(eventExpenses.eventId, eventId), inArray(eventExpenses.budgetLineId, obsolete)));
      await db.delete(eventBudgetLines).where(and(eq(eventBudgetLines.eventId, eventId), inArray(eventBudgetLines.id, obsolete)));
    }
    await db.delete(eventBudgetLines).where(and(eq(eventBudgetLines.eventId, eventId), eq(eventBudgetLines.plannedCents, 0), isNull(eventBudgetLines.eventProfessionalId)));

    // ── Explicit grants (e.g. wedding planner may read health data) ──
    for (const g of spec.grants ?? []) {
      const memberId = memberIdByUserKey.get(g.userKey);
      const by = ctx.users[g.byUserKey];
      if (!memberId || !by) continue;
      const inserted = await db.insert(eventPermissions).values({ eventId, memberId, permission: g.permission, effect: "allow", grantedByUserId: by }).onConflictDoNothing().returning({ id: eventPermissions.id });
      if (inserted.length) await db.insert(auditLogs).values({ actorUserId: by, action: "event.permission.set", resourceType: "event_member", resourceId: memberId, eventId, metadata: { permission: g.permission, effect: "allow" }, reason: "Coordination de l'espace enfants (démo)" });
    }

    // ── Owner's calendar entry for the day ──
    await db
      .insert(calendarEntries)
      .values({ ownerUserId: ownerId, eventId, kind: "event", title: spec.name, location: `${spec.venueName}, ${spec.city}`, startsAt, endsAt, allDay: false, timezone: tz, icalUid: `event-${eventId}@sousnosailes.fr` })
      .onConflictDoNothing();
  }
}

async function ensureComment(ctx: SeedContext, taskId: string, c: { from: string; body: string; daysAgo: number }) {
  const authorUserId = ctx.users[c.from];
  if (!authorUserId) return;
  const [has] = await ctx.db.select({ id: eventTaskComments.id }).from(eventTaskComments).where(and(eq(eventTaskComments.taskId, taskId), eq(eventTaskComments.authorUserId, authorUserId), eq(eventTaskComments.body, c.body))).limit(1);
  if (has) return;
  const createdAt = new Date(ctx.now.getTime() - c.daysAgo * 86_400_000 - (c.body.length % 7) * 3_600_000);
  await ctx.db.insert(eventTaskComments).values({ taskId, authorUserId, body: c.body, createdAt, updatedAt: createdAt });
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function rollover(end: Date, start: Date | null): Date {
  return start && end <= start ? new Date(end.getTime() + 86_400_000) : end;
}

/** Display name used for a provider slot when the professionals seed has not created the listing yet. */
export function demoProName(proKey: string): string {
  const names: Record<string, string> = { marie: "Marie Delcourt, garde d'enfants", camille: "Camille Ferrand, wedding planner", julien: "Julien Rossi Traiteur", helene: "Domaine des Tilleuls", theo: "DJ Théo Lambert", ines: "Inès Garnier Photographe", sofia: "Sofia Martins Animation" };
  return names[proKey] ?? proKey;
}
