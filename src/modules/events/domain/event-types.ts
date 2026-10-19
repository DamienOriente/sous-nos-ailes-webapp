export const EVENT_TYPES = ["wedding", "baptism", "birthday", "seminar", "corporate", "family_gathering", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: "Mariage",
  baptism: "Baptême",
  birthday: "Anniversaire",
  seminar: "Séminaire",
  corporate: "Évènement d'entreprise",
  family_gathering: "Réunion familiale",
  other: "Autre évènement",
};

export const EVENT_STATUS_LABELS = {
  planning: "En préparation",
  confirmed: "Confirmé",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
  archived: "Archivé",
} as const;

export type ChecklistSeedItem = { section: string; title: string; description?: string; dueDaysBefore: number | null; sortOrder: number };

const COMMON_END: ChecklistSeedItem[] = [
  { section: "Dernière ligne droite", title: "Confirmer les horaires avec chaque prestataire", dueDaysBefore: 7, sortOrder: 900 },
  { section: "Dernière ligne droite", title: "Partager le planning du jour J à l'équipe", dueDaysBefore: 5, sortOrder: 910 },
  { section: "Dernière ligne droite", title: "Préparer la liste des contacts d'urgence", dueDaysBefore: 3, sortOrder: 920 },
];

const CHILDREN_BLOCK: ChecklistSeedItem[] = [
  { section: "Enfants", title: "Estimer le nombre et l'âge des enfants présents", dueDaysBefore: 120, sortOrder: 300 },
  { section: "Enfants", title: "Réserver une garde d'enfants ou une animation", description: "C'est notre spécialité : comparez les professionnels vérifiés de l'annuaire.", dueDaysBefore: 90, sortOrder: 310 },
  { section: "Enfants", title: "Prévoir un espace enfants (coin calme, sieste, jeux)", dueDaysBefore: 60, sortOrder: 320 },
  { section: "Enfants", title: "Inscrire les enfants et recueillir les consignes des parents", dueDaysBefore: 21, sortOrder: 330 },
  { section: "Enfants", title: "Définir les personnes autorisées à récupérer chaque enfant", dueDaysBefore: 7, sortOrder: 340 },
];

export const CHECKLIST_SEED: Record<EventType, ChecklistSeedItem[]> = {
  wedding: [
    { section: "Lieu", title: "Choisir et réserver le lieu de réception", dueDaysBefore: 365, sortOrder: 100 },
    { section: "Lieu", title: "Réserver le lieu de cérémonie", dueDaysBefore: 300, sortOrder: 110 },
    { section: "Prestataires", title: "Réserver le traiteur", dueDaysBefore: 270, sortOrder: 200 },
    { section: "Prestataires", title: "Réserver le photographe et le vidéaste", dueDaysBefore: 240, sortOrder: 210 },
    { section: "Prestataires", title: "Réserver le DJ ou les musiciens", dueDaysBefore: 210, sortOrder: 220 },
    { section: "Prestataires", title: "Choisir le fleuriste et la décoration", dueDaysBefore: 150, sortOrder: 230 },
    ...CHILDREN_BLOCK,
    { section: "Invités", title: "Établir la liste des invités", dueDaysBefore: 180, sortOrder: 400 },
    { section: "Invités", title: "Envoyer les invitations", dueDaysBefore: 120, sortOrder: 410 },
    { section: "Invités", title: "Relancer les invités sans réponse", dueDaysBefore: 45, sortOrder: 420 },
    { section: "Invités", title: "Finaliser le plan de table", dueDaysBefore: 14, sortOrder: 430 },
    { section: "Budget", title: "Fixer le budget global et sa répartition", dueDaysBefore: 330, sortOrder: 500 },
    { section: "Budget", title: "Vérifier les acomptes versés", dueDaysBefore: 60, sortOrder: 510 },
    ...COMMON_END,
  ],
  baptism: [
    { section: "Lieu", title: "Fixer la date avec la paroisse ou la mairie", dueDaysBefore: 120, sortOrder: 100 },
    { section: "Lieu", title: "Réserver la salle ou le restaurant", dueDaysBefore: 90, sortOrder: 110 },
    { section: "Prestataires", title: "Choisir le traiteur ou le menu", dueDaysBefore: 60, sortOrder: 200 },
    { section: "Prestataires", title: "Réserver un photographe", dueDaysBefore: 60, sortOrder: 210 },
    ...CHILDREN_BLOCK.map((i) => ({ ...i, dueDaysBefore: i.dueDaysBefore ? Math.round(i.dueDaysBefore / 2) : null })),
    { section: "Invités", title: "Inviter la famille et les proches", dueDaysBefore: 60, sortOrder: 400 },
    ...COMMON_END,
  ],
  birthday: [
    { section: "Lieu", title: "Choisir le lieu (maison, salle, extérieur)", dueDaysBefore: 60, sortOrder: 100 },
    { section: "Prestataires", title: "Prévoir le gâteau et le buffet", dueDaysBefore: 30, sortOrder: 200 },
    { section: "Prestataires", title: "Réserver une animation (magicien, DJ, atelier)", dueDaysBefore: 45, sortOrder: 210 },
    ...CHILDREN_BLOCK.map((i) => ({ ...i, dueDaysBefore: i.dueDaysBefore ? Math.round(i.dueDaysBefore / 3) : null })),
    { section: "Invités", title: "Envoyer les invitations", dueDaysBefore: 30, sortOrder: 400 },
    ...COMMON_END,
  ],
  seminar: [
    { section: "Lieu", title: "Réserver le lieu et les salles de travail", dueDaysBefore: 120, sortOrder: 100 },
    { section: "Lieu", title: "Réserver l'hébergement des participants", dueDaysBefore: 90, sortOrder: 110 },
    { section: "Prestataires", title: "Choisir le traiteur (pauses, déjeuners, dîner)", dueDaysBefore: 60, sortOrder: 200 },
    { section: "Prestataires", title: "Prévoir les activités de cohésion", dueDaysBefore: 60, sortOrder: 210 },
    { section: "Prestataires", title: "Vérifier le matériel technique (vidéoprojection, sono)", dueDaysBefore: 21, sortOrder: 220 },
    { section: "Participants", title: "Envoyer le programme et les convocations", dueDaysBefore: 30, sortOrder: 400 },
    ...COMMON_END,
  ],
  corporate: [
    { section: "Lieu", title: "Réserver le lieu", dueDaysBefore: 90, sortOrder: 100 },
    { section: "Prestataires", title: "Choisir le traiteur", dueDaysBefore: 60, sortOrder: 200 },
    { section: "Prestataires", title: "Réserver l'animation et la sonorisation", dueDaysBefore: 45, sortOrder: 210 },
    { section: "Enfants", title: "Prévoir une garde d'enfants si les familles sont invitées", dueDaysBefore: 45, sortOrder: 300 },
    { section: "Participants", title: "Envoyer les invitations et suivre les réponses", dueDaysBefore: 30, sortOrder: 400 },
    ...COMMON_END,
  ],
  family_gathering: [
    { section: "Lieu", title: "Choisir le lieu de la réunion", dueDaysBefore: 90, sortOrder: 100 },
    { section: "Prestataires", title: "Organiser les repas", dueDaysBefore: 30, sortOrder: 200 },
    ...CHILDREN_BLOCK.map((i) => ({ ...i, dueDaysBefore: i.dueDaysBefore ? Math.round(i.dueDaysBefore / 3) : null })),
    { section: "Invités", title: "Confirmer les présences", dueDaysBefore: 21, sortOrder: 400 },
    ...COMMON_END,
  ],
  other: [
    { section: "Organisation", title: "Définir l'objectif, la date et le lieu", dueDaysBefore: 90, sortOrder: 100 },
    { section: "Prestataires", title: "Identifier les prestataires nécessaires", dueDaysBefore: 60, sortOrder: 200 },
    { section: "Invités", title: "Inviter les participants", dueDaysBefore: 30, sortOrder: 400 },
    ...COMMON_END,
  ],
};
