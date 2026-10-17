import { describe, expect, it } from "vitest";
import { coverCatalog, defaultCoverPhotoId, isCatalogPhotoId, resolveEventCover } from "@/modules/events/domain/cover";
import { buildBudgetTemplate, MILESTONE_TEMPLATES, milestoneTemplateLabel, TASK_SUGGESTIONS } from "@/modules/events/domain/suggestions";
import { EVENT_TYPES } from "@/modules/events/domain/event-types";

describe("event cover", () => {
  it("picks a deterministic catalogue photo per event type and seed", () => {
    const a = defaultCoverPhotoId("wedding", "seed-a");
    expect(a).toBe(defaultCoverPhotoId("wedding", "seed-a"));
    expect(isCatalogPhotoId(a)).toBe(true);
    expect(coverCatalog("wedding").some((p) => p.id === a)).toBe(true);
    // Several seeds spread over the catalogue (not always the first photo).
    const ids = new Set(["1", "2", "3", "4", "5", "6", "7", "8"].map((s) => defaultCoverPhotoId("wedding", s)));
    expect(ids.size).toBeGreaterThan(1);
  });

  it("every event type has a non-empty catalogue", () => {
    for (const type of EVENT_TYPES) expect(coverCatalog(type).length).toBeGreaterThan(0);
  });

  it("an uploaded file wins, an unknown catalogue id falls back", () => {
    expect(resolveEventCover({ id: "e1", type: "wedding", coverPhotoId: "x", coverFileId: "f1" })).toEqual({ kind: "file", fileId: "f1" });
    const fallback = resolveEventCover({ id: "e1", type: "birthday", coverPhotoId: "not-a-photo", coverFileId: null });
    expect(fallback.kind).toBe("catalog");
    if (fallback.kind === "catalog") expect(isCatalogPhotoId(fallback.photo.id)).toBe(true);
  });
});

describe("suggestions", () => {
  it("a wedding has eight classic moments with valid times", () => {
    expect(MILESTONE_TEMPLATES.wedding).toHaveLength(8);
    for (const type of EVENT_TYPES) {
      for (const m of MILESTONE_TEMPLATES[type]) {
        expect(m.start).toMatch(/^\d{2}:\d{2}$/);
        if (m.end) expect(m.end).toMatch(/^\d{2}:\d{2}$/);
      }
      expect(TASK_SUGGESTIONS[type].length).toBeGreaterThan(0);
    }
    expect(milestoneTemplateLabel("wedding")).toBe("Ajouter les 8 moments classiques d'un mariage");
  });

  it("builds an indicative budget from the provider slots and the headcount", () => {
    const lines = buildBudgetTemplate({
      type: "wedding",
      expectedGuests: 90,
      expectedChildren: 10,
      slots: [
        { id: "s1", categorySlug: "traiteur", categoryName: "Traiteur", quoteCents: null, status: "shortlisted" },
        { id: "s2", categorySlug: "domaine-reception", categoryName: "Domaine de réception", quoteCents: 850_000, status: "confirmed" },
        { id: "s3", categorySlug: "garde-enfants-evenementielle", categoryName: "Garde d'enfants", quoteCents: null, status: "declined" },
      ],
      existingCategories: new Set(),
    });
    const traiteur = lines.find((l) => l.category === "Traiteur");
    expect(traiteur?.plannedCents).toBe(860_000); // 9 500 × 90 = 855 000, rounded to the euro hundred
    expect(traiteur?.eventProfessionalId).toBe("s1");
    // A known quote replaces the estimate; a declined slot is ignored.
    expect(lines.find((l) => l.category === "Lieu")?.plannedCents).toBe(850_000);
    expect(lines.some((l) => l.category === "Enfants")).toBe(false);
    // Base posts come with amounts rounded to the euro hundred.
    for (const l of lines) expect(l.plannedCents % 10_000).toBe(0);
    expect(lines.some((l) => l.label === "Imprévus (5 %)")).toBe(true);
  });

  it("skips categories that already carry a line", () => {
    const lines = buildBudgetTemplate({ type: "birthday", expectedGuests: 20, expectedChildren: 12, slots: [], existingCategories: new Set(["Décoration"]) });
    expect(lines.some((l) => l.category === "Décoration")).toBe(false);
    expect(lines.some((l) => l.category === "Divers")).toBe(true);
  });
});
