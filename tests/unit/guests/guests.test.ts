import { describe, expect, it } from "vitest";
import { computeRsvpStats, guestToCsvRow, parseBooleanFr, rowsToGuestDrafts } from "@/modules/guests/domain/guests";

describe("computeRsvpStats", () => {
  it("counts statuses, children and expected headcount", () => {
    const stats = computeRsvpStats([
      { isChild: false, rsvpStatus: "accepted", rsvpGuestsCount: 2, plusOnesAllowed: 1 },
      { isChild: true, rsvpStatus: "accepted", rsvpGuestsCount: null, plusOnesAllowed: 0 },
      { isChild: false, rsvpStatus: "declined", rsvpGuestsCount: null, plusOnesAllowed: 0 },
      { isChild: false, rsvpStatus: "maybe", rsvpGuestsCount: null, plusOnesAllowed: 0 },
      { isChild: true, rsvpStatus: "pending", rsvpGuestsCount: null, plusOnesAllowed: 0 },
    ]);
    expect(stats).toEqual({ total: 5, accepted: 2, declined: 1, maybe: 1, pending: 1, children: 2, expectedHeadcount: 4 });
  });
});

describe("rowsToGuestDrafts", () => {
  it("maps columns, infers children from age, clamps companions", () => {
    const { drafts, errors } = rowsToGuestDrafts(
      ["Prénom", "Nom", "Groupe", "Enfant", "Âge", "Régime", "Accompagnants", "Email"],
      [
        ["Léa", "Marchand", "Famille Marchand", "oui", "6", "", "0", ""],
        ["Bernard", "Marchand", "Famille Marchand", "", "", "Sans porc", "25", "bernard@ex.fr"],
        ["", "", "", "", "", "", "", ""],
        ["Noah", "Marchand", "", "", "3", "", "", "pas-un-mail"],
      ],
    );
    expect(drafts).toHaveLength(3);
    expect(drafts[0]).toMatchObject({ isChild: true, ageYears: 6, groupName: "Famille Marchand" });
    expect(drafts[1]).toMatchObject({ isChild: false, ageYears: null, dietaryPreference: "Sans porc", plusOnesAllowed: 10, email: "bernard@ex.fr" });
    expect(drafts[2]).toMatchObject({ isChild: true, ageYears: 3, email: null });
    expect(errors).toEqual([{ line: 4, message: "Ligne ignorée : aucun nom." }, { line: 5, message: "E-mail invalide : « pas-un-mail »" }]);
  });
  it("parses French booleans", () => {
    expect(parseBooleanFr("Oui")).toBe(true);
    expect(parseBooleanFr("x")).toBe(true);
    expect(parseBooleanFr("non")).toBe(false);
    expect(parseBooleanFr(undefined)).toBe(false);
  });
  it("serialises a guest row with labels", () => {
    const row = guestToCsvRow({ firstName: "Léa", lastName: "M", email: null, phone: null, groupName: "Famille", isChild: true, ageYears: 6, dietaryPreference: null, plusOnesAllowed: 0, rsvpStatus: "accepted", rsvpGuestsCount: 1, rsvpMessage: null, notes: null });
    expect(row).toContain("oui");
    expect(row).toContain("Accepté");
  });
});
