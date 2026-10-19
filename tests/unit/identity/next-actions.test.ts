import { describe, expect, it } from "vitest";
import { deriveNextActions, type NextActionInput } from "@/modules/identity/domain/next-actions";

const today = new Date("2027-03-01T10:00:00Z");
const base: NextActionInput = { today, emailVerified: true, twoFactorRequiredButMissing: false, unreadCount: 0, events: [], professionals: [] };

describe("deriveNextActions", () => {
  it("returns nothing for a quiet, verified account", () => {
    expect(deriveNextActions(base)).toEqual([]);
  });

  it("puts account warnings first", () => {
    const actions = deriveNextActions({ ...base, emailVerified: false, unreadCount: 3 });
    expect(actions.map((a) => a.key)).toEqual(["verify-email", "notifications"]);
    expect(actions[1]!.title).toBe("Lire 3 notifications non lues");
  });

  it("asks for a date when the event has none, only for organisers", () => {
    const events = [
      { id: "a", name: "Mariage de Louis et Lisa", eventDate: null, expectedChildren: 12, status: "planning", role: "owner" },
      { id: "b", name: "Séminaire", eventDate: null, expectedChildren: 0, status: "planning", role: "provider" },
    ];
    const keys = deriveNextActions({ ...base, events }).map((a) => a.key);
    expect(keys).toEqual(["event-date-a"]);
  });

  it("suggests childcare when children are announced within 120 days, the planning in the last week", () => {
    const events = [
      { id: "a", name: "Mariage de Louis et Lisa", eventDate: "2027-06-12", expectedChildren: 12, status: "planning", role: "owner" },
      { id: "b", name: "Baptême de Chloé", eventDate: "2027-03-05", expectedChildren: 4, status: "confirmed", role: "provider" },
    ];
    const actions = deriveNextActions({ ...base, events });
    expect(actions.map((a) => a.key)).toEqual(["event-week-b", "event-childcare-a"]);
    expect(actions[0]!.detail).toContain("Dans 4 jours");
    expect(actions[1]!.detail).toContain("12 enfants");
  });

  it("ignores past events", () => {
    const events = [{ id: "a", name: "Passé", eventDate: "2026-01-01", expectedChildren: 3, status: "completed", role: "owner" }];
    expect(deriveNextActions({ ...base, events })).toEqual([]);
  });

  it("follows the listing status", () => {
    const professionals = [
      { id: "p1", displayName: "", status: "draft", completenessScore: 20 },
      { id: "p2", displayName: "Nuit Blanche", status: "changes_requested", completenessScore: 80 },
      { id: "p3", displayName: "Atelier Pétale", status: "published", completenessScore: 55 },
      { id: "p4", displayName: "Maison Garrigue", status: "published", completenessScore: 95 },
    ];
    const actions = deriveNextActions({ ...base, professionals }, 10);
    expect(actions.map((a) => a.key)).toEqual(["pro-changes-p2", "pro-draft-p1", "pro-complete-p3"]);
    expect(actions[1]!.title).toBe("Terminer l'inscription de votre fiche");
    expect(actions[1]!.href).toBe("/onboarding/professionnel?id=p1&step=2");
  });

  it("caps the list", () => {
    const professionals = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, displayName: `Fiche ${i}`, status: "draft", completenessScore: 10 }));
    expect(deriveNextActions({ ...base, professionals })).toHaveLength(4);
  });
});
