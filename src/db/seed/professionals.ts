import { and, eq, inArray } from "drizzle-orm";
import {
  featuredPlacements,
  inquiries,
  inquiryEvents,
  professionalAvailability,
  professionalCategories,
  professionalCategoryAssignments,
  professionalReviews,
  professionalServices,
  professionalToolActivations,
  professionalVerifications,
  professionals,
  toolDefinitions,
  userProfiles,
  users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { resolveLocation } from "@/modules/professionals/domain/geo";
import { refreshRating } from "@/modules/professionals/application/review-service";
import { recomputeDerived } from "@/modules/professionals/application/professional-service";
import type { ProfessionalStatus } from "@/modules/professionals/domain/status";
import type { VerificationKind } from "@/modules/professionals/domain/verification";
import { DEMO_PASSWORD, type SeedContext } from "./context";

/**
 * Demo professionals. Idempotent: listings are upserted by slug, child rows
 * (services, availability, verifications) are replaced, inquiries/reviews/
 * placements are inserted once. Every row is flagged isDemo where possible.
 */
type Svc = { name: string; description?: string; priceCents?: number; priceUnit?: string; durationMinutes?: number; minAge?: number; maxAge?: number; capacity?: number };
type Pro = {
  key: string;
  /** Existing demo user key, or a new user to create. */
  user: { key: string } | { name: string; email: string };
  slug: string;
  displayName: string;
  category: string;
  secondary?: string[];
  city: string;
  postalCode: string;
  tagline: string;
  description: string;
  priceFromCents?: number;
  priceToCents?: number;
  priceUnit?: string;
  languages?: string[];
  eventTypes?: string[];
  yearsExperience?: number;
  tradeDetails: Record<string, unknown>;
  services: Svc[];
  /** Weekdays (0 = Monday) with full-day availability; empty = no grid (available every day). */
  availability?: number[];
  verificationLevel: number;
  status: ProfessionalStatus;
  statusReason?: string;
  acceptsChildren?: boolean;
  publicEmail?: string;
  publicPhone?: string;
  website?: string;
  radiusKm?: number;
};

const CHILDCARE_DESC = (name: string, city: string) =>
  `${name} accompagne les enfants pendant vos réceptions à ${city} et dans toute la région : accueil des familles, espace de jeux sécurisé, ateliers calmes pendant les discours, sieste pour les plus petits et remise des enfants aux parents avec traçabilité. Chaque intervenante est formée aux premiers secours et nous respectons un ratio d'encadrement annoncé à l'avance. Nous préparons avec vous la liste des enfants, leurs âges et les consignes des parents avant le jour J.`;

const PROS: Pro[] = [
  {
    key: "marie",
    user: { key: "marie" },
    slug: "marie-delcourt-garde-enfants",
    displayName: "Marie Delcourt — Garde d'enfants évènementielle",
    category: "garde-enfants-evenementielle",
    secondary: ["baby-sitting", "animation-enfants"],
    city: "Toulouse",
    postalCode: "31000",
    tagline: "Des enfants heureux, des parents sereins, du premier toast à la dernière danse.",
    description: CHILDCARE_DESC("Marie et son équipe", "Toulouse"),
    priceFromCents: 3500,
    priceToCents: 5500,
    priceUnit: "hour",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "baptism", "corporate", "family_gathering"],
    yearsExperience: 9,
    tradeDetails: { experienceYears: 9, ageRanges: ["1-3", "3-6", "6-10"], services: ["supervision", "activities", "nap_space", "meals", "ceremony"], legalStatus: "micro", maxChildrenPerStaff: 6, qualifications: "CAP AEPE, PSC1 (2025), BAFA", teamSize: 6, insuranceDeclared: true },
    services: [
      { name: "Garde pendant la cérémonie et le cocktail", description: "Deux intervenantes, espace calme, jeux et goûter.", priceCents: 38000, priceUnit: "event", durationMinutes: 240, minAge: 1, maxAge: 10, capacity: 12 },
      { name: "Soirée complète avec coin sieste", description: "Jusqu'à 2 h du matin, lits parapluie fournis.", priceCents: 72000, priceUnit: "event", durationMinutes: 480, minAge: 0, maxAge: 12, capacity: 15 },
      { name: "Atelier créatif thématique", description: "Couronnes de fleurs, badges, dessins pour les mariés.", priceCents: 18000, priceUnit: "event", durationMinutes: 120, minAge: 3, maxAge: 10, capacity: 10 },
    ],
    availability: [3, 4, 5, 6],
    verificationLevel: 5,
    status: "published",
    acceptsChildren: true,
    publicEmail: "contact@marie-delcourt.test",
    publicPhone: "06 12 34 56 78",
    website: "https://marie-delcourt.test",
    radiusKm: 80,
  },
  {
    key: "camille",
    user: { key: "camille" },
    slug: "camille-ferrand-wedding-planner",
    displayName: "Camille Ferrand — Wedding planner",
    category: "wedding-planner",
    city: "Toulouse",
    postalCode: "31500",
    tagline: "Des mariages qui vous ressemblent, coordonnés jusqu'au dernier détail.",
    description: "Camille conçoit et coordonne des mariages en Occitanie depuis douze ans : recherche du lieu, sélection des prestataires, budget, planning du jour J et coordination sur place. Elle porte une attention particulière aux familles avec enfants et travaille main dans la main avec les équipes de garde et d'animation pour que chacun profite de la fête.",
    priceFromCents: 180000,
    priceToCents: 650000,
    priceUnit: "event",
    languages: ["fr", "en", "es"],
    eventTypes: ["wedding", "family_gathering"],
    yearsExperience: 12,
    tradeDetails: { packages: ["full", "partial", "day_of"], eventsPerYear: 18, teamSize: 3, experienceYears: 12, childcareCoordination: true },
    services: [
      { name: "Organisation complète", priceCents: 650000, priceUnit: "event" },
      { name: "Coordination du jour J", priceCents: 180000, priceUnit: "event", durationMinutes: 840 },
    ],
    verificationLevel: 4,
    status: "published",
    publicEmail: "camille@ferrand-planner.test",
    website: "https://ferrand-planner.test",
    radiusKm: 150,
  },
  {
    key: "julien",
    user: { key: "julien" },
    slug: "julien-rossi-traiteur",
    displayName: "Julien Rossi Traiteur",
    category: "traiteur",
    secondary: ["patissier"],
    city: "Albi",
    postalCode: "81000",
    tagline: "Cuisine de terroir revisitée, produits du Tarn, service en salle compris.",
    description: "Traiteur installé à Albi, Julien Rossi compose des cocktails et dîners de réception à partir de produits locaux et de saison. Menus enfants ludiques, gestion rigoureuse des allergies avec protocole écrit, dégustation offerte avant signature. Équipe de service formée, vaisselle et nappage inclus dans toutes les formules.",
    priceFromCents: 6500,
    priceToCents: 14500,
    priceUnit: "guest",
    languages: ["fr", "it"],
    eventTypes: ["wedding", "baptism", "seminar", "corporate"],
    yearsExperience: 15,
    tradeDetails: { cuisines: ["Française", "Occitane / terroir", "Cocktail dînatoire"], diets: ["Végétarien", "Sans gluten", "Allergies (protocole)", "Menus enfants"], minGuests: 30, maxGuests: 350, serviceIncluded: true, rentalIncluded: true, tasting: true },
    services: [
      { name: "Cocktail dînatoire 18 pièces", priceCents: 6500, priceUnit: "guest" },
      { name: "Dîner servi 3 services", priceCents: 11500, priceUnit: "guest" },
      { name: "Menu enfant", priceCents: 1800, priceUnit: "child", minAge: 2, maxAge: 12 },
    ],
    availability: [4, 5, 6],
    verificationLevel: 3,
    status: "published",
    publicPhone: "05 63 00 00 00",
    radiusKm: 120,
  },
  {
    key: "helene",
    user: { key: "helene" },
    slug: "domaine-de-la-brugue",
    displayName: "Domaine de la Brugue",
    category: "domaine-reception",
    secondary: ["hebergement"],
    city: "Lavaur",
    postalCode: "81500",
    tagline: "Un domaine du XVIIIe entre Toulouse et Albi, parc de 4 hectares, 32 couchages.",
    description: "Le Domaine de la Brugue reçoit mariages et séminaires dans une grange restaurée de 300 m² ouvrant sur un parc arboré. Cuisine professionnelle à disposition des traiteurs, libre choix du traiteur, espace enfants sécurisé avec salle de jeux attenante, 32 couchages répartis dans la maison de maître et les dépendances. Musique autorisée jusqu'à 4 h en intérieur.",
    priceFromCents: 450000,
    priceToCents: 900000,
    priceUnit: "event",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "seminar", "corporate", "family_gathering"],
    yearsExperience: 7,
    tradeDetails: { seatedCapacity: 180, standingCapacity: 250, lodgingBeds: 32, amenities: ["Cuisine professionnelle", "Parking", "Accès PMR", "Espace extérieur", "Chapiteau possible", "Piste de danse", "Espace enfants dédié", "Hébergement"], catererPolicy: "free", noiseCurfew: "4 h du matin", childrenSpace: true },
    services: [
      { name: "Location week-end (vendredi 14 h – dimanche 14 h)", priceCents: 900000, priceUnit: "event", capacity: 180 },
      { name: "Journée séminaire", priceCents: 450000, priceUnit: "day", capacity: 80 },
    ],
    verificationLevel: 4,
    status: "published",
    acceptsChildren: true,
    website: "https://domaine-brugue.test",
    radiusKm: 0,
  },
  {
    key: "theo",
    user: { key: "theo" },
    slug: "theo-lambert-dj",
    displayName: "Théo Lambert DJ",
    category: "dj",
    secondary: ["location-materiel"],
    city: "Montauban",
    postalCode: "82000",
    tagline: "Généraliste élégant, sonorisation de cérémonie incluse, lumière chaleureuse.",
    description: "Théo anime des mariages et soirées d'entreprise depuis dix ans avec une approche sur mesure : rendez-vous de préparation, brief musical partagé, moments clés calés avec le planner. Matériel professionnel complet, éclairage d'ambiance et sonorisation de cérémonie en extérieur incluse. Il baisse le volume quand les enfants dansent : promis.",
    priceFromCents: 120000,
    priceToCents: 220000,
    priceUnit: "event",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "birthday", "corporate"],
    yearsExperience: 10,
    tradeDetails: { styles: ["Généraliste", "Pop / variété", "Années 80-90", "Électro / house"], equipment: ["Sonorisation", "Éclairage", "Micro HF", "Machine à fumée"], maxGuests: 300, setupMinutes: 120, powerRequirements: "2 prises 16 A dédiées, accès véhicule à moins de 30 m.", ceremonyMusic: true },
    services: [
      { name: "Soirée dansante (jusqu'à 3 h)", priceCents: 150000, priceUnit: "event", durationMinutes: 420 },
      { name: "Sonorisation de cérémonie laïque", priceCents: 35000, priceUnit: "event", durationMinutes: 90 },
    ],
    availability: [4, 5],
    verificationLevel: 2,
    status: "published",
    radiusKm: 150,
  },
  {
    key: "ines",
    user: { key: "ines" },
    slug: "ines-garnier-photographe",
    displayName: "Inès Garnier Photographe",
    category: "photographe",
    secondary: ["videaste"],
    city: "Toulouse",
    postalCode: "31400",
    tagline: "Reportage sensible et naturel, les enfants photographiés à leur hauteur.",
    description: "Inès documente les mariages et fêtes de famille en Occitanie avec un regard discret et chaleureux. Galerie en ligne sécurisée sous six semaines, fichiers HD, album imprimé en option. Elle aime particulièrement photographier les enfants dans leurs jeux et propose un second photographe pour les grandes réceptions.",
    priceFromCents: 190000,
    priceToCents: 320000,
    priceUnit: "event",
    languages: ["fr", "en", "pt"],
    eventTypes: ["wedding", "baptism", "family_gathering", "birthday"],
    yearsExperience: 8,
    tradeDetails: { styles: ["Reportage / naturel", "Fine art"], deliverables: ["Galerie en ligne", "Fichiers HD", "Album imprimé"], deliveryWeeks: 6, coverageHours: 10, secondShooter: true, childrenFriendly: true },
    services: [
      { name: "Reportage journée complète", priceCents: 260000, priceUnit: "event", durationMinutes: 600 },
      { name: "Séance famille / baptême", priceCents: 45000, priceUnit: "event", durationMinutes: 120 },
    ],
    verificationLevel: 3,
    status: "published",
    acceptsChildren: true,
    website: "https://inesgarnier.test",
    radiusKm: 200,
  },
  {
    key: "sofia",
    user: { key: "sofia" },
    slug: "sofia-martins-animation",
    displayName: "Sofia Martins — Animations enfants",
    category: "animation-enfants",
    secondary: ["garde-enfants-evenementielle"],
    city: "Bordeaux",
    postalCode: "33000",
    tagline: "Ateliers, spectacle de marionnettes et maquillage pour les 3-12 ans.",
    description: "Sofia et ses animatrices transforment un coin de salle en atelier : marionnettes, maquillage, grands jeux coopératifs et spectacle de fin de journée. Programme adapté aux âges, matériel fourni, et une attention constante à la sécurité : liste des enfants, point de rassemblement et remise aux parents. Interventions à Bordeaux, Arcachon et dans toute la Gironde.",
    priceFromCents: 25000,
    priceToCents: 60000,
    priceUnit: "half_day",
    languages: ["fr", "pt", "es"],
    eventTypes: ["wedding", "baptism", "birthday", "corporate"],
    yearsExperience: 6,
    tradeDetails: { animationTypes: ["workshops", "games", "show", "face_painting"], ageRanges: ["3-6", "6-10", "10-14"], durations: ["2-4h", "half_day"], maxParticipants: 12, materialsIncluded: true, experienceYears: 6 },
    services: [
      { name: "Après-midi animé (3 h)", priceCents: 42000, priceUnit: "event", durationMinutes: 180, minAge: 3, maxAge: 12, capacity: 15 },
      { name: "Spectacle de marionnettes", priceCents: 25000, priceUnit: "event", durationMinutes: 45, minAge: 2, maxAge: 8, capacity: 40 },
    ],
    availability: [2, 5, 6],
    verificationLevel: 3,
    status: "published",
    acceptsChildren: true,
    radiusKm: 90,
  },
  // ── Additional fictitious listings ─────────────────────────────────────
  {
    key: "petits-nuages",
    user: { name: "Léa Fontaine", email: "pro-petits-nuages@sousnosailes.test" },
    slug: "les-petits-nuages",
    displayName: "Les Petits Nuages",
    category: "garde-enfants-evenementielle",
    secondary: ["baby-sitting"],
    city: "Bordeaux",
    postalCode: "33200",
    tagline: "Garde d'enfants bienveillante pour mariages et séminaires en Gironde.",
    description: CHILDCARE_DESC("Les Petits Nuages", "Bordeaux"),
    priceFromCents: 3200,
    priceToCents: 4800,
    priceUnit: "hour",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "corporate", "seminar"],
    yearsExperience: 5,
    tradeDetails: { experienceYears: 5, ageRanges: ["0-1", "1-3", "3-6", "6-10"], services: ["supervision", "activities", "nap_space", "night"], legalStatus: "company", maxChildrenPerStaff: 5, qualifications: "Auxiliaire de puériculture, PSC1", teamSize: 8, insuranceDeclared: true },
    services: [{ name: "Garde soirée (6 h)", priceCents: 48000, priceUnit: "event", durationMinutes: 360, minAge: 0, maxAge: 10, capacity: 10 }],
    availability: [4, 5, 6],
    verificationLevel: 4,
    status: "published",
    acceptsChildren: true,
    radiusKm: 100,
  },
  {
    key: "nounou-fete",
    user: { name: "Amina Chekroun", email: "pro-nounou-de-fete@sousnosailes.test" },
    slug: "nounou-de-fete",
    displayName: "Nounou de Fête",
    category: "baby-sitting",
    secondary: ["garde-enfants-evenementielle"],
    city: "Montpellier",
    postalCode: "34000",
    tagline: "Baby-sitting évènementiel à Montpellier, de l'apéritif au petit matin.",
    description: CHILDCARE_DESC("Nounou de Fête", "Montpellier"),
    priceFromCents: 2800,
    priceToCents: 4000,
    priceUnit: "hour",
    languages: ["fr", "ar", "en"],
    eventTypes: ["wedding", "birthday", "family_gathering"],
    yearsExperience: 4,
    tradeDetails: { experienceYears: 4, ageRanges: ["1-3", "3-6", "6-10"], services: ["supervision", "nap_space", "night"], legalStatus: "micro", maxChildrenPerStaff: 6, qualifications: "PSC1", teamSize: 3, insuranceDeclared: true },
    services: [{ name: "Garde de nuit sur place", priceCents: 32000, priceUnit: "event", durationMinutes: 480, minAge: 1, maxAge: 10, capacity: 8 }],
    availability: [4, 5, 6],
    verificationLevel: 2,
    status: "published",
    acceptsChildren: true,
    radiusKm: 60,
  },
  {
    key: "ribambelle",
    user: { name: "Paulin Garrigues", email: "pro-ribambelle@sousnosailes.test" },
    slug: "ribambelle-animations",
    displayName: "Ribambelle Animations",
    category: "animation-enfants",
    secondary: ["magicien"],
    city: "Toulouse",
    postalCode: "31300",
    tagline: "Magie, grands jeux et chasse au trésor pour les enfants invités.",
    description: "Ribambelle propose des animations clés en main pour les enfants pendant vos réceptions toulousaines : chasse au trésor dans le parc, atelier magie, grands jeux en bois et spectacle de clôture. Deux animateurs diplômés par groupe de douze enfants, matériel fourni, programme ajusté aux âges annoncés par l'organisateur.",
    priceFromCents: 30000,
    priceToCents: 75000,
    priceUnit: "half_day",
    languages: ["fr"],
    eventTypes: ["wedding", "birthday", "corporate", "family_gathering"],
    yearsExperience: 7,
    tradeDetails: { animationTypes: ["games", "magic", "workshops", "show"], ageRanges: ["3-6", "6-10", "10-14"], durations: ["2-4h", "half_day", "full_day"], maxParticipants: 12, materialsIncluded: true, experienceYears: 7 },
    services: [{ name: "Chasse au trésor + spectacle", priceCents: 55000, priceUnit: "event", durationMinutes: 240, minAge: 4, maxAge: 12, capacity: 24 }],
    availability: [5, 6],
    verificationLevel: 3,
    status: "published",
    acceptsChildren: true,
    radiusKm: 100,
  },
  {
    key: "maison-oliviers",
    user: { name: "Bastien Roques", email: "pro-maison-des-oliviers@sousnosailes.test" },
    slug: "la-maison-des-oliviers",
    displayName: "La Maison des Oliviers",
    category: "domaine-reception",
    city: "Montpellier",
    postalCode: "34090",
    tagline: "Mas languedocien, 120 couverts, oliveraie et piscine, traiteurs partenaires.",
    description: "Au nord de Montpellier, La Maison des Oliviers accueille vos réceptions dans un mas restauré entouré d'oliviers centenaires. Salle de 120 couverts, terrasse ombragée, piscine sécurisée par barrière, parking privé. Traiteurs partenaires sélectionnés, espace enfants aménageable dans l'ancienne bergerie.",
    priceFromCents: 380000,
    priceToCents: 600000,
    priceUnit: "event",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "seminar", "corporate"],
    yearsExperience: 4,
    tradeDetails: { seatedCapacity: 120, standingCapacity: 180, lodgingBeds: 10, amenities: ["Parking", "Espace extérieur", "Piscine", "Piste de danse", "Espace enfants dédié"], catererPolicy: "list", noiseCurfew: "2 h du matin", childrenSpace: true },
    services: [{ name: "Location journée + soirée", priceCents: 480000, priceUnit: "event", capacity: 120 }],
    verificationLevel: 2,
    status: "published",
    acceptsChildren: true,
    radiusKm: 0,
  },
  {
    key: "salle-capitole",
    user: { name: "Nadia Berthier", email: "pro-espace-capitole@sousnosailes.test" },
    slug: "espace-capitole",
    displayName: "Espace Capitole",
    category: "salle-evenementielle",
    city: "Toulouse",
    postalCode: "31000",
    tagline: "Salle modulable en centre-ville, 200 places, équipée pour les séminaires.",
    description: "Espace Capitole propose 400 m² modulables en plein centre de Toulouse : plénière de 200 places, trois salles de sous-commission, régie audiovisuelle intégrée, accès PMR et métro à 100 m. Libre choix du traiteur, office équipé. Idéal pour séminaires, lancements de produit et réceptions d'entreprise.",
    priceFromCents: 180000,
    priceToCents: 350000,
    priceUnit: "day",
    languages: ["fr", "en"],
    eventTypes: ["seminar", "corporate", "birthday"],
    yearsExperience: 10,
    tradeDetails: { seatedCapacity: 200, standingCapacity: 300, lodgingBeds: 0, amenities: ["Accès PMR", "Sonorisation", "Parking"], catererPolicy: "free", noiseCurfew: "1 h du matin", childrenSpace: false },
    services: [{ name: "Journée séminaire plénière + 3 salles", priceCents: 280000, priceUnit: "day", capacity: 200 }],
    verificationLevel: 3,
    status: "published",
    radiusKm: 0,
  },
  {
    key: "table-garonne",
    user: { name: "Mathilde Aubry", email: "pro-table-de-garonne@sousnosailes.test" },
    slug: "la-table-de-garonne",
    displayName: "La Table de Garonne",
    category: "traiteur",
    city: "Toulouse",
    postalCode: "31200",
    tagline: "Traiteur de réception à Toulouse, cuisine méditerranéenne et végétale.",
    description: "La Table de Garonne cuisine pour vos réceptions une carte méditerranéenne généreuse, avec une vraie offre végétarienne et végane, des menus enfants et une gestion documentée des allergies. Service en salle, vaisselle et nappage compris. Dégustation sur rendez-vous dans notre atelier de Toulouse.",
    priceFromCents: 5800,
    priceToCents: 12000,
    priceUnit: "guest",
    languages: ["fr", "es"],
    eventTypes: ["wedding", "baptism", "corporate", "family_gathering"],
    yearsExperience: 11,
    tradeDetails: { cuisines: ["Méditerranéenne", "Végétarienne", "Cocktail dînatoire"], diets: ["Végétarien", "Végan", "Sans lactose", "Allergies (protocole)", "Menus enfants"], minGuests: 20, maxGuests: 250, serviceIncluded: true, rentalIncluded: true, tasting: true },
    services: [{ name: "Buffet méditerranéen", priceCents: 7800, priceUnit: "guest" }, { name: "Menu enfant", priceCents: 1500, priceUnit: "child", minAge: 2, maxAge: 12 }],
    availability: [3, 4, 5, 6],
    verificationLevel: 4,
    status: "published",
    radiusKm: 100,
  },
  {
    key: "douceurs-albi",
    user: { name: "Clément Vidal", email: "pro-douceurs-albigeoises@sousnosailes.test" },
    slug: "douceurs-albigeoises",
    displayName: "Douceurs Albigeoises",
    category: "patissier",
    city: "Albi",
    postalCode: "81000",
    tagline: "Pièces montées, wedding cakes et sweet tables depuis l'atelier d'Albi.",
    description: "Pâtissier-chocolatier à Albi, Clément réalise pièces montées traditionnelles, wedding cakes décorés et tables de douceurs pour les enfants. Options sans gluten et sans lactose, livraison et montage sur place dans le Tarn et la Haute-Garonne. Dégustation de trois parfums offerte.",
    priceFromCents: 650,
    priceToCents: 1400,
    priceUnit: "guest",
    languages: ["fr"],
    eventTypes: ["wedding", "baptism", "birthday"],
    yearsExperience: 14,
    tradeDetails: { cuisines: ["Pâtisserie"], diets: ["Sans gluten", "Sans lactose", "Menus enfants"], minGuests: 20, maxGuests: 400, serviceIncluded: false, rentalIncluded: false, tasting: true },
    services: [{ name: "Pièce montée (choux)", priceCents: 650, priceUnit: "guest" }, { name: "Sweet table enfants", priceCents: 25000, priceUnit: "event", capacity: 30 }],
    verificationLevel: 2,
    status: "published",
    radiusKm: 90,
  },
  {
    key: "studio-lumiere",
    user: { name: "Hugo Delmas", email: "pro-studio-lumiere@sousnosailes.test" },
    slug: "studio-lumiere-bordeaux",
    displayName: "Studio Lumière",
    category: "videaste",
    secondary: ["photographe"],
    city: "Bordeaux",
    postalCode: "33800",
    tagline: "Films de mariage cinématographiques, drone et teaser réseaux en 48 h.",
    description: "Studio Lumière réalise des films de mariage au style cinématographique à Bordeaux et dans le Sud-Ouest : captation à deux caméras, prises de vue drone (télépilote déclaré), teaser pour vos réseaux sous 48 h et film long sous douze semaines. Nous travaillons en binôme avec votre photographe pour rester discrets.",
    priceFromCents: 220000,
    priceToCents: 390000,
    priceUnit: "event",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "corporate"],
    yearsExperience: 6,
    tradeDetails: { styles: ["Éditorial", "Documentaire"], deliverables: ["Film court", "Film long", "Teaser réseaux", "Drone"], deliveryWeeks: 12, coverageHours: 12, secondShooter: true, childrenFriendly: false },
    services: [{ name: "Film de mariage + teaser", priceCents: 290000, priceUnit: "event", durationMinutes: 720 }],
    verificationLevel: 2,
    status: "published",
    radiusKm: 250,
  },
  {
    key: "dj-nova",
    user: { name: "Karim Ben Saïd", email: "pro-dj-nova@sousnosailes.test" },
    slug: "dj-nova-montpellier",
    displayName: "DJ Nova",
    category: "dj",
    city: "Montpellier",
    postalCode: "34070",
    tagline: "Électro, house et classiques pour faire danser toutes les générations.",
    description: "DJ Nova anime depuis huit ans des mariages, anniversaires et soirées d'entreprise entre Montpellier, Nîmes et Béziers. Brief musical partagé avec les mariés, playlist indicative, sonorisation et éclairage inclus jusqu'à 250 invités. Sonorisation de cérémonie et de cocktail possible en option.",
    priceFromCents: 95000,
    priceToCents: 180000,
    priceUnit: "event",
    languages: ["fr", "ar", "en"],
    eventTypes: ["wedding", "birthday", "corporate"],
    yearsExperience: 8,
    tradeDetails: { styles: ["Électro / house", "Hip-hop / R&B", "Généraliste", "Latino"], equipment: ["Sonorisation", "Éclairage", "Micro HF"], maxGuests: 250, setupMinutes: 90, powerRequirements: "Une prise 16 A dédiée.", ceremonyMusic: true },
    services: [{ name: "Soirée dansante", priceCents: 120000, priceUnit: "event", durationMinutes: 360 }],
    availability: [4, 5],
    verificationLevel: 1,
    status: "published",
    radiusKm: 120,
  },
  {
    key: "fleurs-sauvages",
    user: { name: "Océane Lacroix", email: "pro-fleurs-sauvages@sousnosailes.test" },
    slug: "fleurs-sauvages-atelier",
    displayName: "Fleurs Sauvages — Atelier floral",
    category: "fleuriste",
    secondary: ["decorateur"],
    city: "Toulouse",
    postalCode: "31100",
    tagline: "Compositions champêtres de saison, fleurs françaises, zéro mousse florale.",
    description: "Fleurs Sauvages compose bouquets, arches et décors de table à partir de fleurs françaises de saison, sans mousse florale. Océane accompagne les mariés du moodboard à l'installation sur site le jour J, et propose des couronnes de fleurs pour les enfants d'honneur. Interventions dans toute la région toulousaine.",
    priceFromCents: 90000,
    priceToCents: 350000,
    priceUnit: "event",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "baptism", "corporate"],
    yearsExperience: 6,
    tradeDetails: { specialties: "Décor floral champêtre, arches de cérémonie, couronnes pour enfants d'honneur, fleurs françaises de saison.", experienceYears: 6, durations: ["full_day"], travelIncluded: true },
    services: [{ name: "Décor floral complet (cérémonie + tables)", priceCents: 220000, priceUnit: "event" }],
    verificationLevel: 2,
    status: "published",
    radiusKm: 80,
  },
  {
    key: "makeup-perle",
    user: { name: "Sarah Ohayon", email: "pro-perle-makeup@sousnosailes.test" },
    slug: "perle-makeup-bordeaux",
    displayName: "Perle Make-up",
    category: "maquilleur",
    secondary: ["coiffeur"],
    city: "Bordeaux",
    postalCode: "33000",
    tagline: "Maquillage et coiffure de mariée à domicile, essai inclus.",
    description: "Sarah maquille et coiffe les mariées et leurs proches à domicile ou sur le lieu de réception, à Bordeaux et dans la Gironde. Essai inclus, produits hypoallergéniques, retouches possibles avant la soirée. Elle propose également des maquillages festifs pour les enfants d'honneur.",
    priceFromCents: 18000,
    priceToCents: 45000,
    priceUnit: "event",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "birthday"],
    yearsExperience: 9,
    tradeDetails: { specialties: "Maquillage mariée longue tenue, coiffure de cérémonie, maquillage enfants d'honneur.", experienceYears: 9, durations: ["2-4h", "half_day"], travelIncluded: true },
    services: [{ name: "Mariée : essai + jour J (maquillage et coiffure)", priceCents: 42000, priceUnit: "event", durationMinutes: 180 }],
    verificationLevel: 1,
    status: "published",
    radiusKm: 70,
  },
  {
    key: "photobooth-sud",
    user: { name: "Yannick Peyre", email: "pro-photobooth-sud@sousnosailes.test" },
    slug: "photobooth-sud",
    displayName: "Photobooth Sud",
    category: "location-photobooth",
    secondary: ["location-materiel"],
    city: "Albi",
    postalCode: "81000",
    tagline: "Bornes photo avec impression illimitée, livrées et installées dans le Tarn.",
    description: "Photobooth Sud loue des bornes photo modernes avec impression illimitée, accessoires et galerie en ligne, livrées et installées dans le Tarn, la Haute-Garonne et l'Aveyron. Formule miroir magique pour les mariages, formule compacte pour les anniversaires et séminaires.",
    priceFromCents: 45000,
    priceToCents: 90000,
    priceUnit: "event",
    languages: ["fr"],
    eventTypes: ["wedding", "birthday", "corporate", "seminar"],
    yearsExperience: 5,
    tradeDetails: { specialties: "Bornes photo, miroir magique, impression illimitée, galerie en ligne.", experienceYears: 5, durations: ["evening_night", "full_day"], travelIncluded: true },
    services: [{ name: "Borne photo soirée (impression illimitée)", priceCents: 55000, priceUnit: "event", durationMinutes: 360 }],
    verificationLevel: 1,
    status: "published",
    radiusKm: 120,
  },
  {
    key: "petites-mains",
    user: { name: "Julie Serres", email: "pro-petites-mains@sousnosailes.test" },
    slug: "les-petites-mains-montpellier",
    displayName: "Les Petites Mains",
    category: "garde-enfants-evenementielle",
    city: "Montpellier",
    postalCode: "34080",
    tagline: "Garde d'enfants et ateliers créatifs pour vos réceptions dans l'Hérault.",
    description: CHILDCARE_DESC("Les Petites Mains", "Montpellier"),
    priceFromCents: 3000,
    priceToCents: 4500,
    priceUnit: "hour",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "baptism", "corporate"],
    yearsExperience: 3,
    tradeDetails: { experienceYears: 3, ageRanges: ["3-6", "6-10"], services: ["supervision", "activities"], legalStatus: "association", maxChildrenPerStaff: 8, qualifications: "BAFA, PSC1", teamSize: 4, insuranceDeclared: true },
    services: [{ name: "Garde + ateliers (4 h)", priceCents: 36000, priceUnit: "event", durationMinutes: 240, minAge: 3, maxAge: 10, capacity: 16 }],
    availability: [5, 6],
    verificationLevel: 1,
    status: "pending_review",
    acceptsChildren: true,
    radiusKm: 60,
  },
  {
    key: "quatuor-ondes",
    user: { name: "Élise Marty", email: "pro-quatuor-ondes@sousnosailes.test" },
    slug: "quatuor-ondes",
    displayName: "Quatuor Ondes",
    category: "musicien",
    city: "Toulouse",
    postalCode: "31000",
    tagline: "Quatuor à cordes pour cérémonies et cocktails, répertoire classique et pop.",
    description: "Quatuor Ondes accompagne cérémonies laïques, messes et cocktails avec un répertoire allant de Bach aux reprises pop. Quatre musiciens professionnels issus de l'Orchestre du Capitole, sonorisation autonome pour les extérieurs, arrangements sur demande pour votre entrée.",
    priceFromCents: 90000,
    priceToCents: 160000,
    priceUnit: "event",
    languages: ["fr", "en", "de"],
    eventTypes: ["wedding", "corporate"],
    yearsExperience: 12,
    tradeDetails: { styles: ["Classique / cérémonie", "Pop / variété", "Jazz / soul"], equipment: ["Sonorisation"], maxGuests: 300, setupMinutes: 45, powerRequirements: "Une prise 16 A si extérieur.", ceremonyMusic: true },
    services: [{ name: "Cérémonie + cocktail (2 h 30)", priceCents: 120000, priceUnit: "event", durationMinutes: 150 }],
    verificationLevel: 1,
    status: "pending_review",
    radiusKm: 150,
  },
  {
    key: "navettes-occitanes",
    user: { name: "Rémi Castan", email: "pro-navettes-occitanes@sousnosailes.test" },
    slug: "navettes-occitanes",
    displayName: "Navettes Occitanes",
    category: "transport",
    city: "Toulouse",
    postalCode: "31700",
    tagline: "Navettes invités et voitures de collection avec chauffeur.",
    description: "Navettes Occitanes organise le transport de vos invités entre hôtels, cérémonie et lieu de réception : minibus 19 places, autocars 50 places et voitures de collection avec chauffeur pour les mariés. Sièges enfants fournis sur demande.",
    priceFromCents: 45000,
    priceToCents: 180000,
    priceUnit: "event",
    languages: ["fr"],
    eventTypes: ["wedding", "corporate", "seminar"],
    yearsExperience: 8,
    tradeDetails: { specialties: "Navettes minibus et autocars, voitures de collection avec chauffeur, sièges enfants.", experienceYears: 8, durations: ["evening_night", "full_day"], travelIncluded: false },
    services: [{ name: "Navette 19 places (soirée, 3 rotations)", priceCents: 65000, priceUnit: "event" }],
    verificationLevel: 1,
    status: "changes_requested",
    statusReason: "Merci de préciser les licences de transport de personnes et de compléter la description des véhicules.",
    radiusKm: 100,
  },
  {
    key: "atelier-papier",
    user: { name: "Manon Teyssier", email: "pro-atelier-papier@sousnosailes.test" },
    slug: "atelier-papier-plume",
    displayName: "Atelier Papier & Plume",
    category: "decorateur",
    city: "Bordeaux",
    postalCode: "33300",
    tagline: "Scénographie et papeterie sur mesure.",
    description: "Scénographie d'évènement, papeterie et signalétique faites main.",
    languages: ["fr"],
    eventTypes: ["wedding"],
    tradeDetails: { specialties: "Scénographie, papeterie." },
    services: [],
    verificationLevel: 0,
    status: "draft",
    radiusKm: 50,
  },
];

const VERIFICATION_PLAN: Array<{ level: number; kind: VerificationKind; statement: string; validMonths?: number }> = [
  { level: 1, kind: "identity_declared", statement: "Identité et coordonnées renseignées par le professionnel lors de l'inscription." },
  { level: 2, kind: "business_registration_checked", statement: "SIREN rapproché d'un avis de situation SIRENE daté de moins de trois mois." },
  { level: 2, kind: "administrative_check_done", statement: "Cohérence identité / immatriculation / coordonnées vérifiée par l'équipe." },
  { level: 3, kind: "documents_reviewed", statement: "Justificatifs transmis lus par un modérateur ; aucune garantie de qualité de prestation." },
  { level: 4, kind: "insurance_verified", statement: "Attestation RC professionnelle en cours de validité examinée.", validMonths: 10 },
  { level: 5, kind: "qualification_verified", statement: "Diplômes et attestations de formation (CAP AEPE, PSC1) examinés." },
];

async function ensureUser(ctx: SeedContext, pro: Pro): Promise<string> {
  if ("key" in pro.user) {
    const id = ctx.users[pro.user.key];
    if (!id) throw new Error(`demo user ${pro.user.key} missing from context`);
    return id;
  }
  const { db } = ctx;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, pro.user.email)).limit(1);
  let id = existing?.id;
  if (!id) {
    const res = await auth.api.signUpEmail({ body: { email: pro.user.email, password: DEMO_PASSWORD, name: pro.user.name } });
    id = res.user.id;
  }
  await db.update(users).set({ emailVerified: true, isDemo: true }).where(eq(users.id, id));
  const [first, ...rest] = pro.user.name.split(" ");
  await db
    .insert(userProfiles)
    .values({ userId: id, firstName: first ?? "", lastName: rest.join(" "), primaryIntent: "professional", onboardingCompletedAt: ctx.now })
    .onConflictDoUpdate({ target: userProfiles.userId, set: { primaryIntent: "professional", onboardingCompletedAt: ctx.now } });
  ctx.users[`pro:${pro.key}`] = id;
  return id;
}

async function upsertListing(ctx: SeedContext, pro: Pro, ownerUserId: string): Promise<string> {
  const { db } = ctx;
  const categoryId = ctx.categories[pro.category];
  if (!categoryId) throw new Error(`category ${pro.category} missing`);
  const loc = resolveLocation(pro.city, pro.postalCode);
  const moderator = ctx.users.moderator ?? null;
  const values = {
    ownerUserId,
    slug: pro.slug,
    displayName: pro.displayName,
    tagline: pro.tagline,
    description: pro.description,
    primaryCategoryId: categoryId,
    status: pro.status,
    statusReason: pro.statusReason ?? null,
    city: pro.city,
    postalCode: pro.postalCode,
    department: loc.department?.code ?? null,
    region: loc.region,
    latitude: loc.latitude,
    longitude: loc.longitude,
    interventionRadiusKm: pro.radiusKm ?? 50,
    priceFromCents: pro.priceFromCents ?? null,
    priceToCents: pro.priceToCents ?? null,
    priceUnit: pro.priceUnit ?? null,
    languages: pro.languages ?? ["fr"],
    eventTypes: pro.eventTypes ?? [],
    yearsExperience: pro.yearsExperience ?? null,
    tradeDetails: pro.tradeDetails,
    publicEmail: pro.publicEmail ?? null,
    publicPhone: pro.publicPhone ?? null,
    website: pro.website ?? null,
    socialLinks: {},
    isDemo: true,
    acceptsChildrenServices: pro.acceptsChildren ?? false,
    publishedAt: pro.status === "published" ? new Date(ctx.now.getTime() - 90 * 24 * 3600 * 1000) : null,
    deletedAt: null,
  };
  const [row] = await db
    .insert(professionals)
    .values(values)
    .onConflictDoUpdate({ target: professionals.slug, set: values })
    .returning({ id: professionals.id });
  if (!row) throw new Error("upsert failed");
  const id = row.id;

  await db.delete(professionalCategoryAssignments).where(eq(professionalCategoryAssignments.professionalId, id));
  const secondaryIds = (pro.secondary ?? []).map((s) => ctx.categories[s]).filter((x): x is string => Boolean(x));
  if (secondaryIds.length) await db.insert(professionalCategoryAssignments).values(secondaryIds.map((categoryId) => ({ professionalId: id, categoryId })));

  await db.delete(professionalServices).where(eq(professionalServices.professionalId, id));
  if (pro.services.length) {
    await db.insert(professionalServices).values(
      pro.services.map((s, i) => ({
        professionalId: id,
        name: s.name,
        description: s.description ?? null,
        priceCents: s.priceCents ?? null,
        priceUnit: s.priceUnit ?? null,
        durationMinutes: s.durationMinutes ?? null,
        minAge: s.minAge ?? null,
        maxAge: s.maxAge ?? null,
        capacity: s.capacity ?? null,
        sortOrder: i,
      })),
    );
  }

  await db.delete(professionalAvailability).where(eq(professionalAvailability.professionalId, id));
  if (pro.availability?.length) {
    await db.insert(professionalAvailability).values(pro.availability.flatMap((weekday) => [{ professionalId: id, weekday, startMinute: 8 * 60, endMinute: 12 * 60 }, { professionalId: id, weekday, startMinute: 12 * 60, endMinute: 18 * 60 }, { professionalId: id, weekday, startMinute: 18 * 60, endMinute: 24 * 60 }]));
  }

  await db.delete(professionalVerifications).where(eq(professionalVerifications.professionalId, id));
  const rows = VERIFICATION_PLAN.filter((v) => v.level <= pro.verificationLevel).map((v) => ({
    professionalId: id,
    kind: v.kind,
    status: "verified" as const,
    statement: v.statement,
    reviewedByUserId: v.kind === "identity_declared" ? null : moderator,
    reviewedAt: new Date(ctx.now.getTime() - 60 * 24 * 3600 * 1000),
    validUntil: v.validMonths ? new Date(ctx.now.getTime() + v.validMonths * 30 * 24 * 3600 * 1000) : null,
  }));
  // Declared-but-not-verified rows add realism for mid levels.
  if (pro.verificationLevel >= 2 && pro.verificationLevel < 4 && pro.tradeDetails.insuranceDeclared) {
    rows.push({ professionalId: id, kind: "insurance_declared", status: "verified" as const, statement: "Le professionnel déclare détenir une RC professionnelle ; attestation en attente d'examen.", reviewedByUserId: null, reviewedAt: new Date(ctx.now.getTime() - 60 * 24 * 3600 * 1000), validUntil: null });
  }
  if (rows.length) await db.insert(professionalVerifications).values(rows);

  // Default tools of the trade (free ones), idempotent.
  const [cat] = await db.select({ defaultTools: professionalCategories.defaultTools }).from(professionalCategories).where(eq(professionalCategories.id, categoryId)).limit(1);
  const keys = cat?.defaultTools ?? [];
  if (keys.length) {
    const free = await db.select({ key: toolDefinitions.key, requiredFeature: toolDefinitions.requiredFeature }).from(toolDefinitions).where(inArray(toolDefinitions.key, keys));
    for (const t of free.filter((t) => !t.requiredFeature)) {
      await db.insert(professionalToolActivations).values({ professionalId: id, toolKey: t.key, enabled: true }).onConflictDoNothing();
    }
  }
  await recomputeDerived(id, db);
  return id;
}

type DemoInquiry = { proKey: string; requesterKey: string; kind: "contact" | "availability" | "quote"; status: "new" | "viewed" | "quoted" | "accepted" | "confirmed" | "declined"; message: string; quoteCents?: number; childrenCount?: number; guestsCount?: number; daysAgo: number };

const INQUIRIES: DemoInquiry[] = [
  { proKey: "marie", requesterKey: "louis", kind: "quote", status: "confirmed", message: "Bonjour Marie, nous nous marions le 12 juin 2027 au Domaine de la Brugue avec une quinzaine d'enfants de 1 à 10 ans. Pourriez-vous nous faire un devis pour la cérémonie, le cocktail et la soirée ?", quoteCents: 110000, childrenCount: 15, guestsCount: 120, daysAgo: 45 },
  { proKey: "marie", requesterKey: "paul", kind: "availability", status: "viewed", message: "Bonjour, êtes-vous disponible le samedi 20 septembre 2026 pour un baptême à Toulouse avec 8 enfants ?", childrenCount: 8, guestsCount: 40, daysAgo: 2 },
  { proKey: "marie", requesterKey: "lisa", kind: "contact", status: "new", message: "Nous aimerions ajouter un atelier couronnes de fleurs pour les enfants pendant le vin d'honneur. Est-ce possible en complément de la garde ?", childrenCount: 15, daysAgo: 0 },
  { proKey: "julien", requesterKey: "louis", kind: "quote", status: "quoted", message: "Devis pour 120 convives, cocktail + dîner servi, avec 15 menus enfants et 3 invités sans gluten.", quoteCents: 1420000, guestsCount: 120, childrenCount: 15, daysAgo: 30 },
  { proKey: "theo", requesterKey: "louis", kind: "quote", status: "accepted", message: "Soirée dansante jusqu'à 3 h + sonorisation de la cérémonie laïque en extérieur.", quoteCents: 185000, guestsCount: 120, daysAgo: 28 },
  { proKey: "ines", requesterKey: "louis", kind: "contact", status: "confirmed", message: "Nous adorons votre approche naturelle. Reportage journée complète avec second photographe ?", guestsCount: 120, daysAgo: 60 },
  { proKey: "sofia", requesterKey: "paul", kind: "quote", status: "confirmed", message: "Baptême de Chloé le 20 septembre : 8 enfants de 2 à 9 ans, un spectacle de marionnettes serait parfait.", quoteCents: 42000, childrenCount: 8, guestsCount: 40, daysAgo: 20 },
  { proKey: "camille", requesterKey: "paul", kind: "contact", status: "declined", message: "Cherchons une coordination pour un séminaire de 60 personnes en novembre.", guestsCount: 60, daysAgo: 15 },
  { proKey: "petits-nuages", requesterKey: "paul", kind: "availability", status: "new", message: "Disponibilité pour un séminaire d'entreprise à Bordeaux le 14 novembre, 12 enfants attendus.", childrenCount: 12, daysAgo: 1 },
];

const REVIEWS: Array<{ proKey: string; authorKey: string; inquiryIndex: number; rating: number; title: string; body: string; reply?: string }> = [
  { proKey: "marie", authorKey: "louis", inquiryIndex: 0, rating: 5, title: "Les enfants n'ont pas voulu partir", body: "Équipe douce, organisée et très professionnelle. Les parents ont pu profiter de la soirée l'esprit léger, la remise des enfants était impeccable.", reply: "Merci Louis et Lisa ! Un vrai bonheur d'accompagner vos petits invités." },
  { proKey: "ines", authorKey: "louis", inquiryIndex: 5, rating: 5, title: "Un regard tendre", body: "Des photos naturelles, beaucoup de moments volés avec les enfants. Livraison dans les délais annoncés." },
  { proKey: "sofia", authorKey: "paul", inquiryIndex: 6, rating: 4, title: "Spectacle réussi", body: "Les enfants étaient captivés par les marionnettes. Petit bémol sur le temps d'installation, mais tout était prêt à l'heure." },
];

export async function seed(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  for (const pro of PROS) {
    const ownerUserId = await ensureUser(ctx, pro);
    ctx.professionals[pro.key] = await upsertListing(ctx, pro, ownerUserId);
  }

  // Inquiries (optionally linked to the Louis & Lisa wedding when it exists already).
  const inquiryIds: string[] = [];
  for (const q of INQUIRIES) {
    const professionalId = ctx.professionals[q.proKey];
    const requesterUserId = ctx.users[q.requesterKey];
    if (!professionalId || !requesterUserId) continue;
    const [requester] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, requesterUserId)).limit(1);
    if (!requester) continue;
    const [existing] = await db
      .select({ id: inquiries.id })
      .from(inquiries)
      .where(and(eq(inquiries.professionalId, professionalId), eq(inquiries.requesterUserId, requesterUserId), eq(inquiries.kind, q.kind), eq(inquiries.message, q.message)))
      .limit(1);
    if (existing) {
      inquiryIds.push(existing.id);
      continue;
    }
    const createdAt = new Date(ctx.now.getTime() - q.daysAgo * 24 * 3600 * 1000);
    const eventId = q.requesterKey === "louis" || q.requesterKey === "lisa" ? (ctx.events.louisLisa ?? null) : q.requesterKey === "paul" && q.proKey === "sofia" ? (ctx.events.baptemeChloe ?? null) : null;
    const [row] = await db
      .insert(inquiries)
      .values({
        professionalId,
        requesterUserId,
        eventId,
        kind: q.kind,
        status: q.status,
        requesterName: requester.name,
        requesterEmail: requester.email,
        eventTypeLabel: q.proKey === "sofia" || (q.requesterKey === "paul" && q.kind !== "contact") ? "Baptême" : q.requesterKey === "paul" ? "Séminaire" : "Mariage",
        eventDate: q.requesterKey === "paul" ? "2026-09-20" : "2027-06-12",
        eventCity: q.proKey === "petits-nuages" ? "Bordeaux" : q.requesterKey === "paul" ? "Toulouse" : "Lavaur",
        guestsCount: q.guestsCount ?? null,
        childrenCount: q.childrenCount ?? null,
        message: q.message,
        quoteCents: q.quoteCents ?? null,
        quoteNote: q.quoteCents ? "Devis indicatif de démonstration." : null,
        isDemo: true,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: inquiries.id });
    if (!row) continue;
    inquiryIds.push(row.id);
    const steps: Array<{ from: typeof q.status | null; to: typeof q.status | "new" | "viewed" | "quoted" | "accepted"; note: string | null }> = [{ from: null, to: "new", note: "Demande reçue depuis la page publique." }];
    if (q.status !== "new") steps.push({ from: "new", to: "viewed", note: null });
    if (["quoted", "accepted", "confirmed"].includes(q.status)) steps.push({ from: "viewed", to: "quoted", note: q.quoteCents ? `Devis : ${(q.quoteCents / 100).toFixed(2)} €` : null });
    if (["accepted", "confirmed"].includes(q.status)) steps.push({ from: "quoted", to: "accepted", note: "Le demandeur a accepté le devis." });
    if (q.status === "confirmed") steps.push({ from: "accepted", to: "confirmed", note: "Prestation confirmée." });
    if (q.status === "declined") steps.push({ from: "viewed", to: "declined", note: "Indisponible à cette date." });
    const proOwner = (await db.select({ ownerUserId: professionals.ownerUserId }).from(professionals).where(eq(professionals.id, professionalId)).limit(1))[0]?.ownerUserId ?? null;
    await db.insert(inquiryEvents).values(steps.map((s, i) => ({ inquiryId: row.id, actorUserId: i === 0 ? requesterUserId : proOwner, fromStatus: s.from, toStatus: s.to, note: s.note, createdAt: new Date(createdAt.getTime() + i * 3600 * 1000) })));
  }

  // Reviews (published, linked to an inquiry).
  for (const r of REVIEWS) {
    const professionalId = ctx.professionals[r.proKey];
    const authorUserId = ctx.users[r.authorKey];
    if (!professionalId || !authorUserId) continue;
    const [existing] = await db.select({ id: professionalReviews.id }).from(professionalReviews).where(and(eq(professionalReviews.professionalId, professionalId), eq(professionalReviews.authorUserId, authorUserId))).limit(1);
    if (!existing) {
      await db.insert(professionalReviews).values({
        professionalId,
        authorUserId,
        inquiryId: inquiryIds[r.inquiryIndex] ?? null,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: "published",
        replyBody: r.reply ?? null,
        repliedAt: r.reply ? ctx.now : null,
      });
    }
    await refreshRating(professionalId, db);
  }

  // Two active sponsored placements (childcare in Haute-Garonne, animation in Gironde).
  const placements = [
    { proKey: "marie", categorySlug: "garde-enfants-evenementielle", department: "31" },
    { proKey: "sofia", categorySlug: "animation-enfants", department: "33" },
  ];
  for (const p of placements) {
    const professionalId = ctx.professionals[p.proKey];
    if (!professionalId) continue;
    const [existing] = await db
      .select({ id: featuredPlacements.id })
      .from(featuredPlacements)
      .where(and(eq(featuredPlacements.professionalId, professionalId), eq(featuredPlacements.categorySlug, p.categorySlug), eq(featuredPlacements.department, p.department)))
      .limit(1);
    if (existing) {
      await db.update(featuredPlacements).set({ isActive: true, startsAt: new Date(ctx.now.getTime() - 7 * 24 * 3600 * 1000), endsAt: new Date(ctx.now.getTime() + 60 * 24 * 3600 * 1000) }).where(eq(featuredPlacements.id, existing.id));
      continue;
    }
    await db.insert(featuredPlacements).values({ professionalId, categorySlug: p.categorySlug, department: p.department, startsAt: new Date(ctx.now.getTime() - 7 * 24 * 3600 * 1000), endsAt: new Date(ctx.now.getTime() + 60 * 24 * 3600 * 1000), isActive: true });
  }
}
