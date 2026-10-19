import { describe, expect, it } from "vitest";
import { briefSummary, buildBrief, missingBriefFields, type BriefSource } from "@/modules/events/domain/brief";

const src: BriefSource = { type: "wedding", eventDate: "2027-06-12", dateIsTentative: false, startsAt: new Date("2027-06-12T13:30:00Z"), timezone: "Europe/Paris", venueName: "Domaine des Oliviers", city: "Albi", postalCode: "81000", expectedGuests: 120, expectedChildren: 14, budgetCents: 2_500_000, briefShareBudget: false, style: "Champêtre chic", preferences: null };

describe("event brief", () => {
  it("never sends the budget unless the organiser shares it", () => {
    expect(buildBrief(src).budgetCents).toBeNull();
    expect(buildBrief({ ...src, briefShareBudget: true }).budgetCents).toBe(2_500_000);
  });
  it("shows the local start time and a readable summary", () => {
    const b = buildBrief(src);
    expect(b.startTime).toBe("15:30");
    expect(briefSummary(b)).toBe("Mariage, le 2027-06-12, à Albi, 120 invités, dont 14 enfants");
  });
  it("lists what providers would miss", () => {
    expect(missingBriefFields(buildBrief({ ...src, city: null, style: " " }))).toEqual(["la ville", "le style"]);
  });
});
