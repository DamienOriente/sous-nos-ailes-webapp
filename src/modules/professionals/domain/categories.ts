/**
 * Seed catalogue of trades. Admins can add/edit/deactivate categories in the
 * back-office; this list only bootstraps the database and documents the
 * conditional form key + default tools per trade.
 */
export type CategoryGroup = "Enfants" | "Organisation" | "Lieux" | "Restauration" | "Image & son" | "Animation" | "Décoration" | "Beauté" | "Logistique";

export type CategorySeed = {
  slug: string;
  name: string;
  group: CategoryGroup;
  icon: string;
  description: string;
  isChildcare?: boolean;
  formSchemaKey: "childcare" | "animation" | "venue" | "caterer" | "photo" | "dj" | "planner" | "generic";
  defaultTools: string[];
  suggestedTemplates: string[];
  sortOrder: number;
};

export const CATEGORY_SEED: CategorySeed[] = [
  { slug: "garde-enfants-evenementielle", name: "Garde d'enfants évènementielle", group: "Enfants", icon: "baby", description: "Encadrement des enfants pendant un mariage, une réception ou un séminaire.", isChildcare: true, formSchemaKey: "childcare", defaultTools: ["childcare_roster", "childcare_attendance", "childcare_handover", "calendar", "inquiries", "contacts"], suggestedTemplates: ["nid-douillet", "ronde-enfantine", "sauge-elegante"], sortOrder: 1 },
  { slug: "baby-sitting", name: "Baby-sitting", group: "Enfants", icon: "moon", description: "Garde ponctuelle d'enfants en soirée ou en journée.", isChildcare: true, formSchemaKey: "childcare", defaultTools: ["childcare_roster", "childcare_attendance", "childcare_handover", "calendar", "inquiries", "contacts"], suggestedTemplates: ["nid-douillet", "minimal-ivoire"], sortOrder: 2 },
  { slug: "animation-enfants", name: "Animation pour enfants", group: "Enfants", icon: "party-popper", description: "Ateliers, jeux et spectacles pour les enfants invités.", isChildcare: true, formSchemaKey: "animation", defaultTools: ["childcare_roster", "activity_program", "calendar", "inquiries"], suggestedTemplates: ["ronde-enfantine", "confettis", "atelier-creatif"], sortOrder: 3 },
  { slug: "wedding-planner", name: "Wedding planner", group: "Organisation", icon: "clipboard-list", description: "Conception et coordination complète de mariages.", formSchemaKey: "planner", defaultTools: ["event_management", "budget", "timeline", "vendor_comparison", "calendar", "contacts"], suggestedTemplates: ["sauge-elegante", "editorial-luxe", "boheme-lin"], sortOrder: 10 },
  { slug: "domaine-reception", name: "Domaine de réception", group: "Lieux", icon: "castle", description: "Châteaux, domaines et propriétés pour recevoir.", formSchemaKey: "venue", defaultTools: ["venue_calendar", "venue_spaces", "venue_logistics", "calendar", "inquiries"], suggestedTemplates: ["editorial-luxe", "champetre-pierre", "panorama-photo"], sortOrder: 20 },
  { slug: "salle-evenementielle", name: "Salle évènementielle", group: "Lieux", icon: "building-2", description: "Salles de réception et espaces modulables.", formSchemaKey: "venue", defaultTools: ["venue_calendar", "venue_spaces", "venue_logistics", "calendar", "inquiries"], suggestedTemplates: ["corporate-net", "moderne-grille", "panorama-photo"], sortOrder: 21 },
  { slug: "traiteur", name: "Traiteur", group: "Restauration", icon: "chef-hat", description: "Cocktails, dîners et buffets sur mesure.", formSchemaKey: "caterer", defaultTools: ["catering_headcount", "catering_menus", "service_timeline", "calendar", "inquiries"], suggestedTemplates: ["table-gourmande", "editorial-luxe", "champetre-pierre"], sortOrder: 30 },
  { slug: "patissier", name: "Pâtissier", group: "Restauration", icon: "cake", description: "Pièces montées, wedding cakes et desserts.", formSchemaKey: "caterer", defaultTools: ["catering_headcount", "calendar", "inquiries"], suggestedTemplates: ["table-gourmande", "poudre-rose", "minimal-ivoire"], sortOrder: 31 },
  { slug: "photographe", name: "Photographe", group: "Image & son", icon: "camera", description: "Reportage photo de mariage et d'évènement.", formSchemaKey: "photo", defaultTools: ["shot_list", "timeline", "calendar", "inquiries", "gallery"], suggestedTemplates: ["panorama-photo", "galerie-noire", "argentique"], sortOrder: 40 },
  { slug: "videaste", name: "Vidéaste", group: "Image & son", icon: "video", description: "Films de mariage et captations d'évènements.", formSchemaKey: "photo", defaultTools: ["shot_list", "timeline", "calendar", "inquiries", "gallery"], suggestedTemplates: ["galerie-noire", "panorama-photo", "moderne-grille"], sortOrder: 41 },
  { slug: "dj", name: "DJ", group: "Image & son", icon: "disc-3", description: "Animation musicale et sonorisation.", formSchemaKey: "dj", defaultTools: ["music_brief", "timeline", "equipment", "calendar", "inquiries"], suggestedTemplates: ["nuit-electrique", "confettis", "moderne-grille"], sortOrder: 42 },
  { slug: "musicien", name: "Musicien", group: "Image & son", icon: "music", description: "Groupes, duos, musiciens de cérémonie.", formSchemaKey: "dj", defaultTools: ["music_brief", "timeline", "calendar", "inquiries"], suggestedTemplates: ["scene-ouverte", "argentique", "boheme-lin"], sortOrder: 43 },
  { slug: "magicien", name: "Magicien", group: "Animation", icon: "wand-sparkles", description: "Close-up, scène et magie pour enfants.", formSchemaKey: "animation", defaultTools: ["activity_program", "equipment", "calendar", "inquiries"], suggestedTemplates: ["scene-ouverte", "velours-spectacle", "confettis"], sortOrder: 50 },
  { slug: "clown", name: "Clown", group: "Animation", icon: "smile", description: "Spectacles et déambulations pour petits et grands.", formSchemaKey: "animation", defaultTools: ["activity_program", "calendar", "inquiries"], suggestedTemplates: ["confettis", "ronde-enfantine", "velours-spectacle"], sortOrder: 51 },
  { slug: "animateur", name: "Animateur", group: "Animation", icon: "mic", description: "Maîtres de cérémonie, animateurs de soirée et team building.", formSchemaKey: "animation", defaultTools: ["activity_program", "timeline", "calendar", "inquiries"], suggestedTemplates: ["scene-ouverte", "corporate-net", "confettis"], sortOrder: 52 },
  { slug: "decorateur", name: "Décorateur", group: "Décoration", icon: "palette", description: "Scénographie, décoration et mise en scène.", formSchemaKey: "generic", defaultTools: ["calendar", "inquiries", "gallery"], suggestedTemplates: ["atelier-creatif", "boheme-lin", "editorial-luxe"], sortOrder: 60 },
  { slug: "fleuriste", name: "Fleuriste", group: "Décoration", icon: "flower-2", description: "Bouquets, compositions et décors floraux.", formSchemaKey: "generic", defaultTools: ["calendar", "inquiries", "gallery"], suggestedTemplates: ["jardin-fleuri", "poudre-rose", "champetre-pierre"], sortOrder: 61 },
  { slug: "maquilleur", name: "Maquilleur", group: "Beauté", icon: "sparkles", description: "Maquillage mariée et invités.", formSchemaKey: "generic", defaultTools: ["calendar", "inquiries", "gallery"], suggestedTemplates: ["poudre-rose", "minimal-ivoire", "editorial-luxe"], sortOrder: 70 },
  { slug: "coiffeur", name: "Coiffeur", group: "Beauté", icon: "scissors", description: "Coiffure de cérémonie à domicile ou sur place.", formSchemaKey: "generic", defaultTools: ["calendar", "inquiries", "gallery"], suggestedTemplates: ["poudre-rose", "minimal-ivoire", "argentique"], sortOrder: 71 },
  { slug: "location-materiel", name: "Location de matériel", group: "Logistique", icon: "package", description: "Tentes, sonorisation, éclairage, vaisselle.", formSchemaKey: "generic", defaultTools: ["equipment", "calendar", "inquiries"], suggestedTemplates: ["corporate-net", "moderne-grille", "minimal-ivoire"], sortOrder: 80 },
  { slug: "location-mobilier", name: "Location de mobilier", group: "Logistique", icon: "armchair", description: "Tables, chaises, mobilier lounge.", formSchemaKey: "generic", defaultTools: ["equipment", "calendar", "inquiries"], suggestedTemplates: ["moderne-grille", "boheme-lin", "corporate-net"], sortOrder: 81 },
  { slug: "location-photobooth", name: "Location de photobooth", group: "Logistique", icon: "aperture", description: "Bornes photo et animations souvenirs.", formSchemaKey: "generic", defaultTools: ["equipment", "calendar", "inquiries"], suggestedTemplates: ["confettis", "nuit-electrique", "moderne-grille"], sortOrder: 82 },
  { slug: "transport", name: "Transport", group: "Logistique", icon: "car", description: "Voitures de collection, navettes, bus.", formSchemaKey: "generic", defaultTools: ["calendar", "inquiries"], suggestedTemplates: ["argentique", "corporate-net", "minimal-ivoire"], sortOrder: 83 },
  { slug: "hebergement", name: "Hébergement", group: "Logistique", icon: "bed", description: "Gîtes, chambres d'hôtes et hôtels partenaires.", formSchemaKey: "venue", defaultTools: ["venue_calendar", "calendar", "inquiries"], suggestedTemplates: ["champetre-pierre", "nature-foret", "boheme-lin"], sortOrder: 84 },
];

export const CATEGORY_GROUPS: CategoryGroup[] = ["Enfants", "Organisation", "Lieux", "Restauration", "Image & son", "Animation", "Décoration", "Beauté", "Logistique"];
