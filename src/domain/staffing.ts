import type { HeadcountByAge } from "@/domain/labels";
import { AGE_GROUP_KEYS, AGE_GROUP_LABELS } from "@/domain/labels";
import type { AvailabilityStatus, Conflict } from "@/domain/scheduling";

export type StaffingRatios = {
  ratioUnder3: number;
  ratio3to5: number;
  ratio6to10: number;
  ratio11plus: number;
  minProviders: number;
};

const RATIO_KEY: Record<keyof HeadcountByAge, keyof Omit<StaffingRatios, "minProviders">> = {
  childrenUnder3: "ratioUnder3",
  children3to5: "ratio3to5",
  children6to10: "ratio6to10",
  children11plus: "ratio11plus",
};

export type StaffingSuggestion = {
  suggested: number;
  load: number;
  explanation: string[];
  requiresUnder3Study: boolean;
};

/**
 * Suggests a team size from internal working ratios. These ratios are
 * parameters awaiting validation, never presented as regulatory values.
 */
export function suggestProviderCount(headcount: HeadcountByAge, ratios: StaffingRatios): StaffingSuggestion {
  let load = 0;
  const explanation: string[] = [];
  for (const key of AGE_GROUP_KEYS) {
    const count = headcount[key] ?? 0;
    if (count <= 0) continue;
    const ratio = Math.max(1, ratios[RATIO_KEY[key]]);
    load += count / ratio;
    explanation.push(`${count} enfant${count > 1 ? "s" : ""} (${AGE_GROUP_LABELS[key].toLowerCase()}) avec le repère interne de 1 pour ${ratio}`);
  }
  const suggested = Math.max(Math.max(1, ratios.minProviders), Math.ceil(load - 1e-9));
  explanation.push(`Charge calculée ${load.toFixed(2).replace(".", ",")} → ${suggested} intervenant·e${suggested > 1 ? "s" : ""} (repères internes à faire valider).`);
  return { suggested, load, explanation, requiresUnder3Study: (headcount.childrenUnder3 ?? 0) > 0 };
}

export type ProviderCandidate = {
  providerId: string;
  displayName: string;
  sector: string;
  isActive: boolean;
  vettingStatus: "NEW" | "IN_REVIEW" | "ACTIVE" | "PAUSED";
  verifiedQualifications: number;
  skills: string[];
  availability: AvailabilityStatus;
  conflicts: Conflict[];
  alreadyInvited: boolean;
  alreadyAssigned: boolean;
};

export type RankedCandidate = ProviderCandidate & {
  eligible: boolean;
  score: number;
  reasons: string[];
};

function sectorMatches(sector: string, city: string): boolean {
  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const normalizedSector = normalize(sector);
  return normalizedSector.includes(normalize(city)) || /toute|region|départ|depart|national/.test(normalizedSector);
}

/**
 * Ranks providers on availability, sector and verified qualifications only.
 * No personal characteristic (age, gender, origin…) ever enters the ranking.
 * Every reason is spelled out so Marie can judge the suggestion.
 */
export function rankProviderCandidates(
  candidates: ProviderCandidate[],
  context: { city: string; wantedSkills?: string[] },
): RankedCandidate[] {
  const ranked = candidates.map((candidate) => {
    const reasons: string[] = [];
    let score = 0;
    let eligible = true;
    if (!candidate.isActive || candidate.vettingStatus === "PAUSED") {
      eligible = false;
      reasons.push("Profil inactif ou en pause.");
    }
    if (candidate.alreadyAssigned) {
      eligible = false;
      reasons.push("Déjà affecté·e à cet événement.");
    }
    if (candidate.conflicts.length > 0) {
      eligible = false;
      reasons.push(...candidate.conflicts.map((c) => c.explanation));
    }
    if (candidate.availability === "DECLARED_AVAILABLE") {
      score += 40;
      reasons.push("Disponibilité déclarée sur le créneau.");
    } else if (candidate.availability === "PARTIAL") {
      score += 10;
      reasons.push("Disponibilité déclarée partielle.");
    } else {
      reasons.push("Aucune disponibilité déclarée sur ce créneau.");
    }
    if (candidate.vettingStatus === "ACTIVE") {
      score += 25;
      reasons.push("Vérification manuelle effectuée.");
    } else {
      reasons.push("Vérification manuelle non finalisée.");
    }
    if (sectorMatches(candidate.sector, context.city)) {
      score += 20;
      reasons.push(`Secteur d’intervention compatible (${candidate.sector}).`);
    } else {
      reasons.push(`Secteur habituel : ${candidate.sector}.`);
    }
    if (candidate.verifiedQualifications > 0) {
      score += Math.min(15, candidate.verifiedQualifications * 5);
      reasons.push(`${candidate.verifiedQualifications} qualification${candidate.verifiedQualifications > 1 ? "s" : ""} vérifiée${candidate.verifiedQualifications > 1 ? "s" : ""}.`);
    }
    if (context.wantedSkills?.length) {
      const matched = context.wantedSkills.filter((skill) => candidate.skills.includes(skill));
      if (matched.length) {
        score += matched.length * 5;
        reasons.push(`Compétences déclarées utiles : ${matched.join(", ")}.`);
      }
    }
    if (candidate.alreadyInvited) reasons.push("Proposition déjà envoyée.");
    return { ...candidate, eligible, score, reasons };
  });
  return ranked.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.displayName.localeCompare(b.displayName, "fr"));
}
