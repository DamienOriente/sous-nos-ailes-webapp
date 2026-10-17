import type { TriState } from "@/generated/prisma/enums";

export type ChecklistContext = {
  dateIsFlexible: boolean;
  hasDate: boolean;
  hasTimes: boolean;
  crossesMidnight: boolean;
  durationMinutes: number;
  dedicatedSpace: TriState;
  hasSpaceDescription: boolean;
  hasMeetingPoint: boolean;
  hasOnSiteContact: boolean;
  parentsOnSite: TriState;
  childrenUnder3: number;
  hasPartnerVenue: boolean;
  hasVenueMemory: boolean;
};

export type ChecklistTemplateItem = { key: string; label: string };

/** Preparation assistant: a checklist adapted to what is known about the event. */
export function buildChecklist(ctx: ChecklistContext): ChecklistTemplateItem[] {
  const items: ChecklistTemplateItem[] = [];
  if (!ctx.hasDate || ctx.dateIsFlexible) {
    items.push({ key: "fix-date", label: "Fixer la date avec l’organisateur (encore incertaine)" });
  }
  if (!ctx.hasTimes) {
    items.push({ key: "fix-times", label: "Préciser les horaires de début et de fin de la garde" });
  } else {
    items.push({ key: "confirm-times", label: "Confirmer les horaires définitifs avec l’organisateur" });
  }
  if (ctx.dedicatedSpace !== "YES" || !ctx.hasSpaceDescription) {
    items.push({ key: "space", label: "Clarifier et confirmer l’espace réservé aux enfants (surface, accès, sanitaires, point d’eau)" });
  } else {
    items.push({ key: "space-check", label: "Vérifier l’espace enfants sur place le jour J (sécurisation, matériel)" });
  }
  items.push({
    key: "meeting-point",
    label: ctx.hasMeetingPoint ? "Confirmer le point de rendez-vous de l’équipe" : "Définir le point de rendez-vous de l’équipe",
  });
  items.push({
    key: "on-site-contact",
    label: ctx.hasOnSiteContact ? "Vérifier le contact opérationnel sur place" : "Obtenir le contact opérationnel sur place",
  });
  if (ctx.parentsOnSite === "NO") {
    items.push({ key: "handover", label: "Organiser la remise et la reprise des enfants sans parents sur place" });
  } else if (ctx.parentsOnSite === "UNKNOWN") {
    items.push({ key: "parents", label: "Préciser la présence des parents sur place pendant la garde" });
  }
  if (ctx.childrenUnder3 > 0) {
    items.push({
      key: "under-3-study",
      label: "Étudier spécifiquement l’accueil des enfants de moins de 3 ans (étude requise, aucune prise en charge automatique)",
    });
  }
  if (ctx.crossesMidnight) {
    items.push({ key: "overnight", label: "Organiser le relais de l’équipe et le retour après minuit" });
  }
  if (ctx.durationMinutes > 6 * 60) {
    items.push({ key: "breaks", label: "Prévoir les pauses et le relais sur une prestation longue" });
  }
  if (ctx.hasPartnerVenue) {
    items.push({
      key: "venue-memory",
      label: ctx.hasVenueMemory
        ? "Relire la mémoire du lieu et les contraintes d’accès connues"
        : "Documenter le lieu partenaire après la mission (mémoire du lieu)",
    });
  } else {
    items.push({ key: "venue-scouting", label: "Repérer le lieu : accès, stationnement, espaces disponibles" });
  }
  items.push({ key: "material", label: "Préparer le matériel d’activités adapté aux tranches d’âge" });
  items.push({ key: "brief", label: "Transmettre le brief de mission à l’équipe affectée" });
  return items;
}
