import { describe, expect, it } from "vitest";
import { buildChecklist } from "@/domain/checklist";
import { computeReadiness } from "@/domain/readiness";
import { rankProviderCandidates, suggestProviderCount } from "@/domain/staffing";

describe("staffing suggestion", () => {
  it("derives a team size from internal ratios and explains it", () => {
    const suggestion = suggestProviderCount(
      { childrenUnder3: 2, children3to5: 6, children6to10: 8, children11plus: 0 },
      { ratioUnder3: 3, ratio3to5: 6, ratio6to10: 8, ratio11plus: 10, minProviders: 1 },
    );
    // 2/3 + 1 + 1 = 2,67 → 3
    expect(suggestion.suggested).toBe(3);
    expect(suggestion.requiresUnder3Study).toBe(true);
    expect(suggestion.explanation.join(" ")).toMatch(/repères internes/);
  });

  it("ranks on availability, vetting and sector only, with reasons", () => {
    const ranked = rankProviderCandidates(
      [
        {
          providerId: "a",
          displayName: "Alix",
          sector: "Lyon et métropole",
          isActive: true,
          vettingStatus: "ACTIVE",
          verifiedQualifications: 2,
          skills: ["atelier créatif"],
          availability: "DECLARED_AVAILABLE",
          conflicts: [],
          alreadyInvited: false,
          alreadyAssigned: false,
        },
        {
          providerId: "b",
          displayName: "Bérénice",
          sector: "Grenoble",
          isActive: true,
          vettingStatus: "NEW",
          verifiedQualifications: 0,
          skills: [],
          availability: "NOT_DECLARED",
          conflicts: [{ kind: "UNAVAILABILITY", id: "u", explanation: "Indisponibilité déclarée sur ce créneau." }],
          alreadyInvited: false,
          alreadyAssigned: false,
        },
      ],
      { city: "Lyon" },
    );
    expect(ranked[0].providerId).toBe("a");
    expect(ranked[0].eligible).toBe(true);
    expect(ranked[0].reasons.join(" ")).toMatch(/Secteur d’intervention compatible/);
    expect(ranked[1].eligible).toBe(false);
    expect(ranked[1].reasons.join(" ")).toMatch(/Indisponibilité/);
  });
});

describe("preparation assistant", () => {
  it("adapts the checklist to the event context", () => {
    const items = buildChecklist({
      dateIsFlexible: true,
      hasDate: true,
      hasTimes: false,
      crossesMidnight: true,
      durationMinutes: 480,
      dedicatedSpace: "UNKNOWN",
      hasSpaceDescription: false,
      hasMeetingPoint: false,
      hasOnSiteContact: false,
      parentsOnSite: "NO",
      childrenUnder3: 1,
      hasPartnerVenue: true,
      hasVenueMemory: true,
    });
    const keys = items.map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(["fix-date", "fix-times", "space", "meeting-point", "on-site-contact", "handover", "under-3-study", "overnight", "breaks", "venue-memory", "material", "brief"]));
    expect(items.find((i) => i.key === "under-3-study")?.label).toMatch(/aucune prise en charge automatique/);
  });

  it("computes a readiness indicator without any score wording", () => {
    const readiness = computeReadiness({
      hasDate: true,
      dateIsFlexible: false,
      hasTimes: true,
      hasVenue: true,
      spaceConfirmed: false,
      hasMeetingPoint: false,
      hasOnSiteContact: true,
      hasHeadcount: true,
      hasAcceptedQuote: true,
      teamStatus: "PARTIAL",
      checklistDone: 3,
      checklistTotal: 8,
      opsValidated: false,
    });
    expect(readiness.total).toBe(11);
    expect(readiness.completed).toBe(6);
    expect(JSON.stringify(readiness)).not.toMatch(/sécurité|score/i);
  });
});
