/**
 * Worked examples shown beside the professional onboarding, one per trade
 * form. "Utiliser cet exemple" reloads the step with these values as
 * defaults: the professional edits them, nothing is saved until submit.
 * Fictitious businesses only (demo cities of the seed), never a real company.
 */
export type ListingExample = {
  /** Step 2 */
  displayName: string;
  city: string;
  postalCode: string;
  organizationType: "sole_trader" | "company" | "association";
  interventionRadiusKm: number;
  /** Step 3 — matches the trade form fields of the key. */
  tradeDetails: Record<string, unknown>;
  /** Step 4 */
  tagline: string;
  description: string;
  priceFromEuros: number;
  priceToEuros: number;
  priceUnit: "hour" | "half_day" | "day" | "event" | "guest" | "child";
  languages: string[];
  eventTypes: string[];
  yearsExperience: number;
  /** Advice shown next to each step, written for this trade. */
  tips: { identity: string; trade: string; presentation: string };
};

const BASE_TIPS = {
  identity: "Le nom commercial est celui que les organisateurs taperont dans la recherche : évitez les sigles seuls. La ville et le rayon déterminent dans quels annuaires locaux vous apparaissez.",
  presentation: "Les organisateurs lisent l'accroche dans la liste, la description sur votre page. Parlez de ce que vivent leurs invités, pas de votre matériel.",
};

export const LISTING_EXAMPLES: Record<string, ListingExample> = {
  childcare: {
    displayName: "Les Petites Ailes — Garde d'enfants évènementielle",
    city: "Toulouse",
    postalCode: "31000",
    organizationType: "sole_trader",
    interventionRadiusKm: 80,
    tradeDetails: { experienceYears: 7, ageRanges: ["1-3", "3-6", "6-10"], services: ["supervision", "activities", "nap_space", "ceremony"], legalStatus: "micro" },
    tagline: "Un coin enfants serein pendant votre réception, de la cérémonie au dessert.",
    description:
      "Nous accueillons les enfants de vos invités dans un espace dédié et sécurisé : jeux calmes pendant les discours, ateliers créatifs, espace sieste pour les plus petits et remise de chaque enfant à une personne autorisée. Une intervenante pour six enfants au maximum, formée aux premiers secours. Avant le jour J, nous préparons ensemble la liste des enfants, leurs âges et les consignes des parents.",
    priceFromEuros: 35,
    priceToEuros: 55,
    priceUnit: "hour",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "baptism", "corporate"],
    yearsExperience: 7,
    tips: {
      identity: BASE_TIPS.identity,
      trade: "Indiquez le ratio d'encadrement que vous garantissez et les tranches d'âge que vous acceptez vraiment : c'est le premier filtre des parents. Les justificatifs (PSC1, casier) seront demandés ensuite et ne sont jamais publiés.",
      presentation: "Décrivez une soirée type du point de vue d'un enfant de 4 ans et de ses parents : où il joue, qui le surveille, comment il est rendu. Les tarifs à l'heure sont les plus lisibles pour ce métier.",
    },
  },
  animation: {
    displayName: "Atelier Pirouette — Animations pour enfants",
    city: "Bordeaux",
    postalCode: "33000",
    organizationType: "sole_trader",
    interventionRadiusKm: 60,
    tradeDetails: { animationTypes: ["workshops", "games", "face_painting"], ageRanges: ["3-6", "6-10"], durations: ["2-4h", "half_day"], maxParticipants: 15, materialsIncluded: true, experienceYears: 5 },
    tagline: "Ateliers créatifs et grands jeux pour que les enfants aient leur propre fête.",
    description:
      "Maquillage, fabrication de masques, chasse au trésor dans le parc du domaine : nous construisons un programme par tranche d'âge, adapté à la durée de votre réception. Tout le matériel est fourni et lavable. Nous travaillons main dans la main avec la garde d'enfants quand il y en a une.",
    priceFromEuros: 280,
    priceToEuros: 650,
    priceUnit: "event",
    languages: ["fr"],
    eventTypes: ["wedding", "birthday", "family_gathering"],
    yearsExperience: 5,
    tips: {
      identity: BASE_TIPS.identity,
      trade: "Précisez le nombre maximal d'enfants par animateur et les durées proposées : un organisateur compare d'abord ces deux chiffres.",
      presentation: "Un programme type (« 17 h atelier masques, 18 h grand jeu ») vaut mieux qu'une liste d'adjectifs.",
    },
  },
  dj: {
    displayName: "Nuit Blanche — DJ & sonorisation",
    city: "Montauban",
    postalCode: "82000",
    organizationType: "sole_trader",
    interventionRadiusKm: 120,
    tradeDetails: { styles: ["Généraliste", "Pop / variété", "Électro / house", "Années 80-90"], equipment: ["Sonorisation", "Éclairage", "Micro HF"], maxGuests: 300, setupMinutes: 90, powerRequirements: "Deux prises 16 A dédiées, accès véhicule à moins de 30 m de la salle.", ceremonyMusic: true },
    tagline: "Une piste pleine jusqu'au bout de la nuit, un brief musical construit avec vous.",
    description:
      "Nous préparons ensemble le déroulé musical : cérémonie, cocktail, dîner, ouverture du bal et soirée. Vous nous indiquez vos indispensables et vos interdits, nous gérons les transitions et le volume en fonction du lieu et du voisinage. Sonorisation et éclairage sont compris jusqu'à 300 invités.",
    priceFromEuros: 900,
    priceToEuros: 1800,
    priceUnit: "event",
    languages: ["fr", "en", "es"],
    eventTypes: ["wedding", "birthday", "corporate"],
    yearsExperience: 10,
    tips: {
      identity: BASE_TIPS.identity,
      trade: "Les besoins électriques et le temps d'installation évitent les mauvaises surprises avec le lieu : soyez précis (ampérage, distance d'accès).",
      presentation: "Indiquez ce qui est compris dans le tarif (sono, lumières, heures supplémentaires) : c'est la question posée dans neuf demandes sur dix.",
    },
  },
  venue: {
    displayName: "Domaine des Cèdres",
    city: "Lavaur",
    postalCode: "81500",
    organizationType: "company",
    interventionRadiusKm: 0,
    tradeDetails: { seatedCapacity: 150, standingCapacity: 220, lodgingBeds: 24, amenities: ["Cuisine professionnelle", "Parking", "Accès PMR", "Espace extérieur", "Espace enfants dédié", "Hébergement"], catererPolicy: "list", noiseCurfew: "3 h du matin", childrenSpace: true },
    tagline: "Une orangerie pour 150 convives, un parc pour la cérémonie et des chambres pour la famille.",
    description:
      "Le domaine accueille un seul évènement à la fois : l'orangerie pour le dîner, la grange pour la soirée et le parc pour la cérémonie laïque. Une pièce calme et sécurisée est réservée aux enfants et à leur garde. Vingt-quatre couchages sur place, cuisine professionnelle à disposition des traiteurs de notre liste.",
    priceFromEuros: 3500,
    priceToEuros: 6500,
    priceUnit: "event",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "seminar", "family_gathering"],
    yearsExperience: 12,
    tips: {
      identity: "Pour un lieu, le rayon d'intervention est sans objet : laissez 0. La ville et le code postal servent au classement par département.",
      trade: "Capacité assise, capacité debout et heure limite de musique sont les trois chiffres regardés avant toute visite. Cochez l'espace enfants si vous pouvez réellement en isoler un.",
      presentation: "Décrivez le déroulé d'une journée dans vos espaces (cérémonie, cocktail, dîner, soirée) plutôt que la liste des pièces.",
    },
  },
  caterer: {
    displayName: "Maison Garrigue — Traiteur",
    city: "Albi",
    postalCode: "81000",
    organizationType: "company",
    interventionRadiusKm: 100,
    tradeDetails: { cuisines: ["Française", "Occitane / terroir", "Cocktail dînatoire"], diets: ["Végétarien", "Sans gluten", "Allergies (protocole)", "Menus enfants"], minGuests: 30, maxGuests: 300, serviceIncluded: true, rentalIncluded: true, tasting: true },
    tagline: "Cuisine de saison, service en salle compris, menus enfants pensés comme les autres.",
    description:
      "Cocktail de douze pièces, dîner en trois services ou buffet de terroir : nous cuisinons des produits de la région, sur place quand le lieu le permet. Le service, la vaisselle et le nappage sont compris. Les régimes et allergies sont gérés avec un protocole écrit, les enfants ont un vrai menu. Dégustation offerte avant signature.",
    priceFromEuros: 65,
    priceToEuros: 110,
    priceUnit: "guest",
    languages: ["fr"],
    eventTypes: ["wedding", "seminar", "corporate", "baptism"],
    yearsExperience: 15,
    tips: {
      identity: BASE_TIPS.identity,
      trade: "Les régimes gérés et le nombre minimal de couverts éliminent les demandes qui ne vous conviennent pas. Le décompte des régimes dans l'application reste anonyme.",
      presentation: "Un tarif par invité, en précisant ce qu'il comprend (service, vaisselle, boissons), est la norme attendue.",
    },
  },
  photo: {
    displayName: "Lumière d'Été — Photographe",
    city: "Toulouse",
    postalCode: "31000",
    organizationType: "sole_trader",
    interventionRadiusKm: 200,
    tradeDetails: { styles: ["Reportage / naturel", "Fine art"], deliverables: ["Galerie en ligne", "Fichiers HD", "Album imprimé"], deliveryWeeks: 6, coverageHours: 10, secondShooter: true, childrenFriendly: true },
    tagline: "Des images vraies, des enfants qui courent, une galerie livrée en six semaines.",
    description:
      "Je photographie votre journée en reportage, sans poses imposées : les préparatifs, la cérémonie, les rires au cocktail et les enfants qui s'échappent sous les tables. Galerie en ligne privée livrée en six semaines, fichiers HD inclus, album sur demande. Un second photographe peut couvrir les deux préparatifs en parallèle.",
    priceFromEuros: 1800,
    priceToEuros: 3200,
    priceUnit: "event",
    languages: ["fr", "en"],
    eventTypes: ["wedding", "baptism", "family_gathering"],
    yearsExperience: 8,
    tips: {
      identity: BASE_TIPS.identity,
      trade: "Le délai de livraison et la durée de couverture habituelle sont les deux premières questions des couples : donnez des chiffres honnêtes.",
      presentation: "Vos photos feront le travail : prévoyez huit à douze images variées dans la galerie dès la publication.",
    },
  },
  planner: {
    displayName: "Camélia Évènements — Wedding planner",
    city: "Toulouse",
    postalCode: "31000",
    organizationType: "company",
    interventionRadiusKm: 150,
    tradeDetails: { packages: ["full", "day_of", "design"], eventsPerYear: 18, teamSize: 3, experienceYears: 9, childcareCoordination: true },
    tagline: "De la première visite au dernier feu d'artifice, une équipe qui pense aussi aux enfants.",
    description:
      "Organisation complète ou coordination du jour J : nous construisons le budget, sélectionnons les prestataires, tenons le planning et gérons l'imprévu. Nous coordonnons systématiquement la garde d'enfants et les animations jeunesse avec le lieu et le traiteur. Trois personnes le jour J, dix-huit mariages par an au maximum.",
    priceFromEuros: 1500,
    priceToEuros: 6000,
    priceUnit: "event",
    languages: ["fr", "en", "it"],
    eventTypes: ["wedding", "corporate"],
    yearsExperience: 9,
    tips: {
      identity: BASE_TIPS.identity,
      trade: "Le nombre d'évènements par an rassure autant qu'il filtre : il dit votre disponibilité réelle.",
      presentation: "Distinguez clairement vos formules (complète, jour J, conseil) et le tarif de départ de chacune.",
    },
  },
  generic: {
    displayName: "Atelier Pétale — Fleuriste",
    city: "Montpellier",
    postalCode: "34000",
    organizationType: "sole_trader",
    interventionRadiusKm: 70,
    tradeDetails: { specialties: "Bouquets de mariée, arches de cérémonie, compositions de table en fleurs de saison et locales. Location de vases et structures.", experienceYears: 6, durations: ["half_day", "full_day"], travelIncluded: true },
    tagline: "Des fleurs de saison, cultivées à moins de 100 km, installées le matin même.",
    description:
      "Bouquet de mariée, boutonnières, arche de cérémonie et centres de table : je travaille des fleurs de saison issues de producteurs locaux. Installation le matin de l'évènement, reprise des structures le lendemain. Les vases et supports sont loués, pas vendus, pour limiter le gaspillage.",
    priceFromEuros: 600,
    priceToEuros: 2500,
    priceUnit: "event",
    languages: ["fr"],
    eventTypes: ["wedding", "baptism", "corporate"],
    yearsExperience: 6,
    tips: {
      identity: BASE_TIPS.identity,
      trade: "Décrivez vos spécialités avec des exemples concrets (arche, centres de table, bouquet) : les organisateurs cherchent un objet, pas un métier.",
      presentation: BASE_TIPS.presentation,
    },
  },
};

export function listingExample(formSchemaKey: string): ListingExample {
  return LISTING_EXAMPLES[formSchemaKey] ?? LISTING_EXAMPLES.generic!;
}

/** One-line summary used by the intent picker and the home page empty state. */
export const PROFESSIONAL_EXAMPLE_SUMMARY = "Exemple : « Les Petites Ailes », garde d'enfants évènementielle à Toulouse, 35 à 55 € de l'heure, 7 ans d'expérience.";
export const ORGANIZER_EXAMPLE_SUMMARY = "Exemple : Mariage de Louis et Lisa, 12 juin 2027 au domaine d'Hélène, 90 invités dont 12 enfants, budget 15 000 €.";
