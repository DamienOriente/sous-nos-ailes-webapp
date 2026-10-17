import { TOOL_SEED } from "@/modules/tools/domain/tool-catalogue";

/**
 * One concrete usage example per tool of the catalogue, shown on the tool
 * cards and in the paywalls. Examples describe a fictitious situation (the
 * demo wedding of Louis and Lisa, demo professionals) and never a real
 * customer. `scene` picks the illustration family used by the card header.
 */
export type ToolScene = "calendar" | "contacts" | "inbox" | "gallery" | "documents" | "dashboard" | "budget" | "timeline" | "scale" | "guests" | "seating" | "invitations" | "children" | "attendance" | "handover" | "activities" | "catering" | "menus" | "venue" | "spaces" | "logistics" | "music" | "equipment" | "camera" | "stats" | "seo";

export type ToolExample = {
  /** Short situation, written as a scene the professional recognises. */
  example: string;
  /** What the tool produces in that situation. */
  outcome: string;
  scene: ToolScene;
};

export const TOOL_EXAMPLES: Record<string, ToolExample> = {
  calendar: { example: "Le mariage de Louis et Lisa est le 12 juin 2027 ; un baptême est demandé le même jour.", outcome: "Le conflit s'affiche avant que vous acceptiez, l'agenda s'exporte en ICS vers votre téléphone.", scene: "calendar" },
  contacts: { example: "Vous travaillez souvent avec le domaine d'Hélène et le traiteur Julien.", outcome: "Vos partenaires sont tagués « lieu » et « traiteur » et retrouvés en deux lettres.", scene: "contacts" },
  inquiries: { example: "Lisa demande votre disponibilité pour 12 enfants de 2 à 9 ans, le 12 juin.", outcome: "La demande arrive qualifiée (date, lieu, âges), vous répondez avec un devis depuis la même fiche.", scene: "inbox" },
  gallery: { example: "Vous ajoutez huit photos de votre coin enfants au domaine d'Hélène.", outcome: "Images optimisées, métadonnées supprimées, affichées sur votre page publique.", scene: "gallery" },
  documents: { example: "Le devis signé et le brief des parents doivent rester accessibles le jour J.", outcome: "Rangés dans un espace chiffré, partagés uniquement avec l'équipe de l'évènement.", scene: "documents" },
  event_management: { example: "Camille coordonne trois mariages ce mois-ci.", outcome: "Une vue par évènement : équipe, prestataires confirmés, budget engagé, prochaines échéances.", scene: "dashboard" },
  budget: { example: "15 000 € prévus, 8 200 € engagés, acompte traiteur versé.", outcome: "Chaque poste indique prévu / engagé / payé, le reste à payer se calcule seul.", scene: "budget" },
  timeline: { example: "Cérémonie 15 h, cocktail 17 h, dîner 20 h, ouverture du bal 23 h.", outcome: "Un déroulé partagé avec le DJ, le traiteur et la garde d'enfants, modifiable jusqu'au dernier moment.", scene: "timeline" },
  vendor_comparison: { example: "Deux traiteurs ont répondu : 68 € et 82 € par convive.", outcome: "Les propositions se comparent côte à côte (prix, inclus, options) avant de choisir.", scene: "scale" },
  guests: { example: "90 invités répartis en famille, amis et collègues.", outcome: "Les réponses se cochent au fil des retours, le nombre d'enfants se met à jour pour la garde.", scene: "guests" },
  seating_plan: { example: "Neuf tables rondes de dix, les enfants regroupés près du coin jeux.", outcome: "Vous glissez les invités sur le plan, la capacité se vérifie, le PDF part à l'imprimeur.", scene: "seating" },
  invitations: { example: "Chaque invité reçoit un lien personnel et un QR code.", outcome: "Les réponses remontent en direct, le QR code sert au contrôle d'accès le jour J.", scene: "invitations" },
  childcare_roster: { example: "12 enfants, dont deux allergiques et un bébé de 8 mois.", outcome: "Âges, consignes autorisées et contacts des parents sur une seule liste, accessible hors connexion.", scene: "children" },
  childcare_attendance: { example: "Emma arrive à 16 h 40, repart avec sa mère à 23 h 15.", outcome: "Check-in, check-out et incidents horodatés, consultables par les organisateurs.", scene: "attendance" },
  childcare_handover: { example: "Seuls les parents et la marraine peuvent récupérer Jules.", outcome: "La personne autorisée est confirmée à la remise, la traçabilité est conservée.", scene: "handover" },
  activity_program: { example: "Atelier masques pour les 3–6 ans à 17 h, grand jeu pour les 6–10 ans à 18 h.", outcome: "Un programme par tranche d'âge que les parents peuvent lire sur l'invitation.", scene: "activities" },
  catering_headcount: { example: "88 couverts adultes, 12 menus enfants, 4 végétariens, 1 sans gluten.", outcome: "Un décompte anonymisé des régimes, sans aucune donnée de santé nominative.", scene: "catering" },
  catering_menus: { example: "Cocktail 12 pièces, dîner trois services, livraison 14 h.", outcome: "Menus, planning de service et matériel sur une fiche partagée avec le lieu.", scene: "menus" },
  service_timeline: { example: "Le plat chaud doit sortir pendant le discours des témoins.", outcome: "Votre timing de service est aligné sur le déroulé de l'organisateur.", scene: "timeline" },
  venue_calendar: { example: "La grange est réservée le samedi, l'orangerie reste libre.", outcome: "Occupation par espace, sans double réservation.", scene: "venue" },
  venue_spaces: { example: "Orangerie 120 assis, grange 200 debout, jardin pour la cérémonie.", outcome: "Les organisateurs voient immédiatement si le lieu convient à leur jauge.", scene: "spaces" },
  venue_logistics: { example: "Installation du DJ à 14 h, accès camion par l'allée nord.", outcome: "Contraintes techniques et créneaux d'installation communiqués à chaque intervenant.", scene: "logistics" },
  music_brief: { example: "Ouverture du bal sur une valse, interdiction formelle du limbo.", outcome: "Les préférences et les moments clés du couple, rangés par séquence de la soirée.", scene: "music" },
  equipment: { example: "Deux prises 16 A dédiées et un accès véhicule à moins de 30 m.", outcome: "Vos besoins techniques sont transmis au lieu avant le jour J.", scene: "equipment" },
  shot_list: { example: "Photo des mariés avec les grands-parents avant le cocktail.", outcome: "Liste des moments à capturer, lieux et autorisations de diffusion recueillies.", scene: "camera" },
  stats: { example: "Votre page a été vue 340 fois en mars, 11 demandes reçues.", outcome: "Vues, demandes et conversion par semaine pour ajuster votre fiche.", scene: "stats" },
  seo_assistant: { example: "Il manque une description de 200 caractères et un titre avec votre ville.", outcome: "Des recommandations concrètes et un aperçu indicatif du résultat Google.", scene: "seo" },
};

export function toolExample(toolKey: string): ToolExample | null {
  return TOOL_EXAMPLES[toolKey] ?? null;
}

/** Keys of the seeded catalogue without an example (should be empty; checked by a unit test). */
export function toolsWithoutExample(): string[] {
  return TOOL_SEED.map((t) => t.key).filter((k) => !(k in TOOL_EXAMPLES));
}
