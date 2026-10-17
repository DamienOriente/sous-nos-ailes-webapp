import type { TeamStatus } from "@/domain/workflow";

export type ReadinessInput = {
  hasDate: boolean;
  dateIsFlexible: boolean;
  hasTimes: boolean;
  hasVenue: boolean;
  spaceConfirmed: boolean;
  hasMeetingPoint: boolean;
  hasOnSiteContact: boolean;
  hasHeadcount: boolean;
  hasAcceptedQuote: boolean;
  teamStatus: TeamStatus;
  checklistDone: number;
  checklistTotal: number;
  opsValidated: boolean;
};

export type ReadinessItem = { key: string; label: string; done: boolean; detail?: string };

export type Readiness = { items: ReadinessItem[]; completed: number; total: number };

/**
 * Preparation indicator: concrete completed/missing elements. It is not a
 * score and never claims to measure safety.
 */
export function computeReadiness(input: ReadinessInput): Readiness {
  const items: ReadinessItem[] = [
    { key: "date", label: "Date fixée", done: input.hasDate && !input.dateIsFlexible },
    { key: "times", label: "Horaires connus", done: input.hasTimes },
    { key: "venue", label: "Lieu identifié", done: input.hasVenue },
    { key: "headcount", label: "Effectifs par âge renseignés", done: input.hasHeadcount },
    { key: "space", label: "Espace enfants confirmé", done: input.spaceConfirmed },
    { key: "meeting-point", label: "Point de rendez-vous défini", done: input.hasMeetingPoint },
    { key: "contact", label: "Contact opérationnel sur place", done: input.hasOnSiteContact },
    { key: "quote", label: "Proposition acceptée (accord de principe)", done: input.hasAcceptedQuote },
    {
      key: "team",
      label: "Équipe complète et affectée",
      done: input.teamStatus === "COMPLETE",
      detail: input.teamStatus === "PARTIAL" ? "Équipe incomplète" : undefined,
    },
    {
      key: "checklist",
      label: "Checklist de préparation terminée",
      done: input.checklistTotal > 0 && input.checklistDone >= input.checklistTotal,
      detail: input.checklistTotal > 0 ? `${input.checklistDone}/${input.checklistTotal}` : "Aucun élément",
    },
    { key: "ops", label: "Points opérationnels validés par Marie", done: input.opsValidated },
  ];
  return { items, completed: items.filter((i) => i.done).length, total: items.length };
}
