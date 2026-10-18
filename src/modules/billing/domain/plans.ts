/**
 * Feature keys checked by the entitlement service. A plan grants a set of
 * features, optionally with a numeric limit. Prices are initial commercial
 * hypotheses, editable in the back-office — nothing is charged for real until
 * Stripe live keys and the legal review are in place.
 */
export const FEATURES = {
  // organizer
  "events.create": "Création d'évènements",
  "directory.search": "Recherche de professionnels",
  "favorites": "Favoris",
  "dashboard.basic": "Tableau de bord essentiel",
  "timeline.basic": "Planning simple",
  "tasks": "Liste de tâches",
  "contacts": "Carnet de contacts",
  "inquiries.send": "Demandes de devis",
  "invitations.basic": "Invitations essentielles",
  "invitations.premium": "Invitations personnalisées et QR codes",
  "seating_plan": "Plan de table",
  "budget.advanced": "Gestion budgétaire avancée",
  "exports.advanced": "Exports avancés (PDF, CSV)",
  "dashboard.advanced": "Tableaux de bord complémentaires",
  "collaboration.extended": "Collaboration étendue",
  "templates.premium": "Modèles premium",
  // professional
  "listing": "Fiche professionnelle",
  "templates.free": "Templates gratuits",
  "templates.all": "Bibliothèque complète de templates",
  "customization.advanced": "Personnalisation avancée",
  "tools.premium": "Outils métier premium",
  "stats": "Statistiques",
  "seo.assistant": "Recommandations SEO",
  "inquiries.receive": "Réception des demandes",
  "calendar.internal": "Calendrier interne",
  "calendar.sync": "Synchronisation Google / Outlook",
  "crm.advanced": "Gestion commerciale avancée",
  "sponsored.eligible": "Éligibilité aux emplacements sponsorisés",
} as const;

export type FeatureKey = keyof typeof FEATURES;

export type PlanSeed = {
  key: string;
  name: string;
  audience: "organizer" | "professional";
  description: string;
  priceMonthlyCents: number;
  isDefault: boolean;
  sortOrder: number;
  features: Partial<Record<FeatureKey, { enabled: boolean; limit?: number }>>;
};

export const PLAN_SEED: PlanSeed[] = [
  {
    key: "organizer_free",
    name: "Organisateur Gratuit",
    audience: "organizer",
    description: "Jusqu'à 3 évènements, 50 contacts et 60 invités par évènement, tâches et demandes de devis.",
    priceMonthlyCents: 0,
    isDefault: true,
    sortOrder: 1,
    features: {
      "events.create": { enabled: true, limit: 3 },
      "directory.search": { enabled: true },
      favorites: { enabled: true },
      "dashboard.basic": { enabled: true },
      "timeline.basic": { enabled: true },
      tasks: { enabled: true },
      contacts: { enabled: true, limit: 50 },
      "inquiries.send": { enabled: true },
      "invitations.basic": { enabled: true, limit: 60 },
    },
  },
  {
    key: "organizer_plus",
    name: "Organisateur Plus",
    audience: "organizer",
    description: "Évènements illimités, plan de table, budget détaillé, invitations personnalisées et exports PDF.",
    priceMonthlyCents: 990,
    isDefault: false,
    sortOrder: 2,
    features: {
      "events.create": { enabled: true },
      "directory.search": { enabled: true },
      favorites: { enabled: true },
      "dashboard.basic": { enabled: true },
      "dashboard.advanced": { enabled: true },
      "timeline.basic": { enabled: true },
      tasks: { enabled: true },
      contacts: { enabled: true },
      "inquiries.send": { enabled: true },
      "invitations.basic": { enabled: true },
      "invitations.premium": { enabled: true },
      seating_plan: { enabled: true },
      "budget.advanced": { enabled: true },
      "exports.advanced": { enabled: true },
      "collaboration.extended": { enabled: true },
      "templates.premium": { enabled: true },
    },
  },
  {
    key: "professional_free",
    name: "Professionnel Gratuit",
    audience: "professional",
    description: "Une fiche dans l'annuaire, la réception des demandes, un calendrier et trois modèles de page.",
    priceMonthlyCents: 0,
    isDefault: true,
    sortOrder: 3,
    features: {
      listing: { enabled: true },
      "templates.free": { enabled: true },
      "inquiries.receive": { enabled: true },
      "calendar.internal": { enabled: true },
      contacts: { enabled: true, limit: 100 },
    },
  },
  {
    key: "professional_premium",
    name: "Professionnel Premium",
    audience: "professional",
    description: "Tous les modèles de page, statistiques, assistant SEO, synchronisation des calendriers et outils métier.",
    priceMonthlyCents: 1990,
    isDefault: false,
    sortOrder: 4,
    features: {
      listing: { enabled: true },
      "templates.free": { enabled: true },
      "templates.all": { enabled: true },
      "customization.advanced": { enabled: true },
      "tools.premium": { enabled: true },
      stats: { enabled: true },
      "seo.assistant": { enabled: true },
      "inquiries.receive": { enabled: true },
      "calendar.internal": { enabled: true },
      "calendar.sync": { enabled: true },
      "crm.advanced": { enabled: true },
      contacts: { enabled: true },
      "sponsored.eligible": { enabled: true },
    },
  },
];
