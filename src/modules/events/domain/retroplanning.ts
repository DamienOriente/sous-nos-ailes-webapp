import { addDays } from "./checklist";
import type { EventType } from "./event-types";

/**
 * Booking retroplanning (2026-10-19): from the event type and date, when to book each trade.
 * Lead times are usual market practice in France, given as indicative guidance (the busiest
 * trades are booked first), never as a rule. Pure.
 */
export type BookingStep = { categorySlug: string; label: string; daysBefore: number; why: string };

const M = 30;

export const BOOKING_PLANS: Record<EventType, BookingStep[]> = {
  wedding: [
    { categorySlug: "domaine-reception", label: "Réserver le lieu de réception", daysBefore: 12 * M, why: "Les lieux sont réservés en premier, souvent un an à l'avance pour les samedis d'été." },
    { categorySlug: "wedding-planner", label: "Choisir le wedding planner", daysBefore: 12 * M, why: "Il aide à choisir les autres prestataires : à engager tôt si vous en voulez un." },
    { categorySlug: "photographe", label: "Réserver le photographe", daysBefore: 10 * M, why: "Un photographe ne couvre qu'un mariage par jour." },
    { categorySlug: "traiteur", label: "Réserver le traiteur", daysBefore: 9 * M, why: "Le menu se construit avec le lieu ; la dégustation vient ensuite." },
    { categorySlug: "videaste", label: "Réserver le vidéaste", daysBefore: 8 * M, why: "Même contrainte que le photographe : une date, un mariage." },
    { categorySlug: "dj", label: "Réserver le DJ ou les musiciens", daysBefore: 7 * M, why: "Les week-ends de saison partent vite." },
    { categorySlug: "garde-enfants-evenementielle", label: "Réserver la garde d'enfants", daysBefore: 5 * M, why: "Le nombre d'enfants est connu avec les premières réponses aux invitations." },
    { categorySlug: "decorateur", label: "Choisir la décoration", daysBefore: 5 * M, why: "Elle dépend du lieu et du style arrêtés." },
    { categorySlug: "fleuriste", label: "Réserver le fleuriste", daysBefore: 4 * M, why: "Les fleurs de saison se choisissent quelques mois avant." },
    { categorySlug: "maquilleur", label: "Réserver maquillage et coiffure", daysBefore: 4 * M, why: "Prévoir un essai deux mois avant." },
    { categorySlug: "patissier", label: "Commander le gâteau", daysBefore: 3 * M, why: "Dégustation puis commande ferme." },
    { categorySlug: "transport", label: "Réserver le transport", daysBefore: 3 * M, why: "Navettes et voiture des mariés." },
    { categorySlug: "location-materiel", label: "Louer le matériel", daysBefore: 2 * M, why: "Les quantités dépendent du plan de table." },
  ],
  baptism: [
    { categorySlug: "salle-evenementielle", label: "Réserver la salle", daysBefore: 4 * M, why: "Les week-ends de printemps sont demandés." },
    { categorySlug: "traiteur", label: "Réserver le traiteur", daysBefore: 3 * M, why: "Repas ou buffet après la cérémonie." },
    { categorySlug: "photographe", label: "Réserver le photographe", daysBefore: 3 * M, why: "Pour la cérémonie et les photos de famille." },
    { categorySlug: "animation-enfants", label: "Réserver l'animation enfants", daysBefore: 2 * M, why: "Les enfants sont nombreux à un baptême." },
    { categorySlug: "patissier", label: "Commander le gâteau", daysBefore: M, why: "Commande ferme un mois avant." },
  ],
  birthday: [
    { categorySlug: "salle-evenementielle", label: "Réserver la salle", daysBefore: 3 * M, why: "Sauf fête à la maison." },
    { categorySlug: "animation-enfants", label: "Réserver l'animation", daysBefore: 2 * M, why: "Les mercredis et samedis partent vite." },
    { categorySlug: "traiteur", label: "Réserver le traiteur", daysBefore: 2 * M, why: "Buffet ou goûter." },
    { categorySlug: "patissier", label: "Commander le gâteau", daysBefore: 21, why: "Trois semaines suffisent en général." },
  ],
  seminar: [
    { categorySlug: "salle-evenementielle", label: "Réserver la salle", daysBefore: 5 * M, why: "Les salles équipées en semaine se réservent tôt." },
    { categorySlug: "hebergement", label: "Réserver l'hébergement", daysBefore: 4 * M, why: "Pour les participants qui viennent de loin." },
    { categorySlug: "traiteur", label: "Réserver le traiteur", daysBefore: 3 * M, why: "Pauses et déjeuners." },
    { categorySlug: "animateur", label: "Réserver l'animation", daysBefore: 2 * M, why: "Ateliers et temps forts." },
    { categorySlug: "garde-enfants-evenementielle", label: "Organiser la garde des enfants", daysBefore: M, why: "Le nombre d'enfants est connu avec les inscriptions." },
  ],
  corporate: [
    { categorySlug: "salle-evenementielle", label: "Réserver le lieu", daysBefore: 6 * M, why: "Les soirées d'entreprise de fin d'année sont très demandées." },
    { categorySlug: "traiteur", label: "Réserver le traiteur", daysBefore: 4 * M, why: "Cocktail ou dîner." },
    { categorySlug: "dj", label: "Réserver la musique", daysBefore: 3 * M, why: "Décembre et juin partent vite." },
    { categorySlug: "photographe", label: "Réserver le photographe", daysBefore: 2 * M, why: "Pour la communication interne." },
  ],
  family_gathering: [
    { categorySlug: "domaine-reception", label: "Réserver le lieu", daysBefore: 4 * M, why: "Un lieu assez grand pour toute la famille." },
    { categorySlug: "traiteur", label: "Réserver le traiteur", daysBefore: 2 * M, why: "Repas pour toutes les générations." },
    { categorySlug: "animation-enfants", label: "Réserver l'animation enfants", daysBefore: 2 * M, why: "Les cousins seront nombreux." },
  ],
  other: [
    { categorySlug: "salle-evenementielle", label: "Réserver le lieu", daysBefore: 3 * M, why: "Le lieu fixe la date." },
    { categorySlug: "traiteur", label: "Réserver le traiteur", daysBefore: 2 * M, why: "Repas ou cocktail." },
  ],
};

export type BookingState = "booked" | "in_progress" | "late" | "now" | "upcoming";
export type RetroItem = BookingStep & { targetDate: string; state: BookingState };

/** Today when the target is already past for a far-off event created late: still "late", shown first. */
export function buildRetroplanning(type: EventType, eventDate: string, today: string, progress: ReadonlyMap<string, "booked" | "in_progress">): RetroItem[] {
  return BOOKING_PLANS[type]
    .map((s) => {
      const targetDate = addDays(eventDate, -s.daysBefore);
      const p = progress.get(s.categorySlug);
      const state: BookingState = p === "booked" ? "booked" : p === "in_progress" ? "in_progress" : targetDate < today ? "late" : targetDate <= addDays(today, 30) ? "now" : "upcoming";
      return { ...s, targetDate, state };
    })
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
}

export const BOOKING_STATE_LABELS: Record<BookingState, string> = { booked: "Réservé", in_progress: "En cours", late: "À faire, en retard", now: "À faire ce mois-ci", upcoming: "Plus tard" };
