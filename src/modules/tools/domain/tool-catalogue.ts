import type { FeatureKey } from "@/modules/billing/domain/plans";

/**
 * Catalogue of trade tools. Activation = (trade relevance) ∧ (role) ∧
 * (entitlement). Seeded into tool_definitions; admins can edit afterwards.
 */
export type ToolSeed = {
  key: string;
  name: string;
  description: string;
  audience: "organizer" | "professional" | "both";
  requiredFeature: FeatureKey | null;
  categorySlugs: string[];
  /** Absolute route (/app/...) or route relative to the professional / event workspace. */
  href: string;
  icon: string;
  sortOrder: number;
};

export const TOOL_SEED: ToolSeed[] = [
  // Common
  { key: "calendar", name: "Calendrier", description: "Agenda, disponibilités, conflits, export ICS.", audience: "both", requiredFeature: null, categorySlugs: [], href: "/app/calendrier", icon: "calendar", sortOrder: 1 },
  { key: "contacts", name: "Contacts", description: "Carnet de contacts, tags, import CSV.", audience: "both", requiredFeature: null, categorySlugs: [], href: "/app/contacts", icon: "book-user", sortOrder: 2 },
  { key: "inquiries", name: "Demandes", description: "Demandes de contact, disponibilité et devis.", audience: "professional", requiredFeature: "inquiries.receive", categorySlugs: [], href: "demandes", icon: "inbox", sortOrder: 3 },
  { key: "gallery", name: "Galerie", description: "Photos de vos réalisations, redimensionnées pour le web.", audience: "professional", requiredFeature: null, categorySlugs: [], href: "page", icon: "images", sortOrder: 4 },
  { key: "documents", name: "Documents", description: "Devis, contrats et briefs sécurisés.", audience: "both", requiredFeature: null, categorySlugs: [], href: "documents", icon: "folder-lock", sortOrder: 5 },
  // Organizer
  { key: "event_management", name: "Gestion des évènements", description: "Équipe, prestataires, budget et échéances d'un évènement.", audience: "organizer", requiredFeature: null, categorySlugs: ["wedding-planner"], href: "", icon: "layout-dashboard", sortOrder: 10 },
  { key: "budget", name: "Budget", description: "Budget prévu, engagé, dépenses.", audience: "organizer", requiredFeature: null, categorySlugs: ["wedding-planner"], href: "budget", icon: "piggy-bank", sortOrder: 11 },
  { key: "timeline", name: "Planning", description: "Déroulé du jour J, moments clés.", audience: "both", requiredFeature: null, categorySlugs: ["wedding-planner", "photographe", "videaste", "dj", "musicien", "traiteur", "animateur"], href: "planning", icon: "clock", sortOrder: 12 },
  { key: "vendor_comparison", name: "Comparaison des devis", description: "Comparez les propositions reçues.", audience: "organizer", requiredFeature: null, categorySlugs: ["wedding-planner"], href: "prestataires", icon: "scale", sortOrder: 13 },
  { key: "guests", name: "Invités et RSVP", description: "Liste des invités, groupes, réponses.", audience: "organizer", requiredFeature: null, categorySlugs: [], href: "invites", icon: "users", sortOrder: 14 },
  { key: "seating_plan", name: "Plan de table", description: "Éditeur visuel, capacité, export PDF.", audience: "organizer", requiredFeature: "seating_plan", categorySlugs: [], href: "plan-de-table", icon: "layout-grid", sortOrder: 15 },
  { key: "invitations", name: "Invitations et QR codes", description: "Invitations, liens sécurisés, QR codes de contrôle.", audience: "organizer", requiredFeature: null, categorySlugs: [], href: "invitations", icon: "mail", sortOrder: 16 },
  // Childcare
  { key: "childcare_roster", name: "Enfants pris en charge", description: "Liste des enfants, âges, consignes autorisées.", audience: "both", requiredFeature: null, categorySlugs: ["garde-enfants-evenementielle", "baby-sitting", "animation-enfants"], href: "enfants", icon: "baby", sortOrder: 20 },
  { key: "childcare_attendance", name: "Présences", description: "Check-in, check-out, incidents.", audience: "both", requiredFeature: null, categorySlugs: ["garde-enfants-evenementielle", "baby-sitting"], href: "enfants", icon: "clipboard-check", sortOrder: 21 },
  { key: "childcare_handover", name: "Remise des enfants", description: "Personnes autorisées, confirmation, traçabilité.", audience: "both", requiredFeature: null, categorySlugs: ["garde-enfants-evenementielle", "baby-sitting"], href: "enfants", icon: "hand-heart", sortOrder: 22 },
  { key: "activity_program", name: "Programme d'activités", description: "Ateliers et animations par tranche d'âge.", audience: "both", requiredFeature: null, categorySlugs: ["animation-enfants", "magicien", "clown", "animateur"], href: "enfants", icon: "puzzle", sortOrder: 23 },
  // Caterer
  { key: "catering_headcount", name: "Convives et régimes", description: "Nombre de couverts et décompte alimentaire anonymisé.", audience: "professional", requiredFeature: null, categorySlugs: ["traiteur", "patissier"], href: "traiteur", icon: "utensils", sortOrder: 30 },
  { key: "catering_menus", name: "Menus et service", description: "Menus, planning de service, livraison, matériel.", audience: "professional", requiredFeature: null, categorySlugs: ["traiteur"], href: "traiteur", icon: "chef-hat", sortOrder: 31 },
  { key: "service_timeline", name: "Planning de service", description: "Timing du service coordonné avec le lieu.", audience: "professional", requiredFeature: null, categorySlugs: ["traiteur"], href: "planning", icon: "clock", sortOrder: 32 },
  // Venue
  { key: "venue_calendar", name: "Calendrier des évènements", description: "Occupation des espaces.", audience: "professional", requiredFeature: null, categorySlugs: ["domaine-reception", "salle-evenementielle", "hebergement"], href: "/app/calendrier", icon: "calendar-days", sortOrder: 40 },
  { key: "venue_spaces", name: "Espaces et capacités", description: "Salles, capacités, affectations.", audience: "professional", requiredFeature: null, categorySlugs: ["domaine-reception", "salle-evenementielle"], href: "lieu", icon: "door-open", sortOrder: 41 },
  { key: "venue_logistics", name: "Logistique et intervenants", description: "Contraintes techniques, planning d'installation.", audience: "professional", requiredFeature: null, categorySlugs: ["domaine-reception", "salle-evenementielle"], href: "lieu", icon: "truck", sortOrder: 42 },
  // DJ / photo
  { key: "music_brief", name: "Brief musical", description: "Préférences, moments clés, playlist indicative.", audience: "professional", requiredFeature: null, categorySlugs: ["dj", "musicien"], href: "musique", icon: "music", sortOrder: 50 },
  { key: "equipment", name: "Matériel et installation", description: "Besoins techniques, électricité, accès.", audience: "professional", requiredFeature: null, categorySlugs: ["dj", "magicien", "location-materiel", "location-mobilier", "location-photobooth"], href: "materiel", icon: "plug", sortOrder: 51 },
  { key: "shot_list", name: "Liste des moments", description: "Moments à capturer, lieux, autorisations de diffusion.", audience: "professional", requiredFeature: null, categorySlugs: ["photographe", "videaste"], href: "images", icon: "camera", sortOrder: 52 },
  // Premium pro
  { key: "stats", name: "Statistiques", description: "Vues, demandes, conversion de votre page.", audience: "professional", requiredFeature: "stats", categorySlugs: [], href: "statistiques", icon: "bar-chart-3", sortOrder: 60 },
  { key: "seo_assistant", name: "Assistant SEO", description: "Complétude, suggestions, aperçu Google indicatif.", audience: "professional", requiredFeature: "seo.assistant", categorySlugs: [], href: "seo", icon: "search-check", sortOrder: 61 },
];
