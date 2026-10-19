import { describe, expect, it } from "vitest";
import { addDays, buildChecklist, isTaskOpen, isTaskOverdue } from "@/modules/events/domain/checklist";
import { CHECKLIST_SEED } from "@/modules/events/domain/event-types";

describe("buildChecklist", () => {
  const templates = [
    { section: "Lieu", title: "Réserver le lieu", description: null, dueDaysBefore: 365, sortOrder: 100 },
    { section: "Dernière ligne droite", title: "Partager le planning", description: null, dueDaysBefore: 5, sortOrder: 910 },
    { section: "Divers", title: "Sans échéance", description: "x", dueDaysBefore: null, sortOrder: 50 },
  ];
  it("computes due dates from the event date and sorts by sortOrder", () => {
    const tasks = buildChecklist(templates, "2027-06-12");
    expect(tasks.map((t) => t.title)).toEqual(["Sans échéance", "Réserver le lieu", "Partager le planning"]);
    expect(tasks[1]!.dueDate).toBe("2026-06-12");
    expect(tasks[2]!.dueDate).toBe("2027-06-07");
    expect(tasks[0]!.dueDate).toBeNull();
  });
  it("leaves due dates empty when the event date is unknown", () => {
    expect(buildChecklist(templates, null).every((t) => t.dueDate === null)).toBe(true);
  });
  it("marks operational sections as team-visible", () => {
    const tasks = buildChecklist(templates, "2027-06-12");
    expect(tasks.find((t) => t.section === "Dernière ligne droite")!.visibility).toBe("team");
    expect(tasks.find((t) => t.section === "Lieu")!.visibility).toBe("organizers");
  });
  it("works for every seeded event type", () => {
    for (const items of Object.values(CHECKLIST_SEED)) {
      const tasks = buildChecklist(items.map((i) => ({ ...i, description: i.description ?? null })), "2027-01-31");
      expect(tasks.length).toBe(items.length);
      for (const t of tasks) if (t.dueDate) expect(t.dueDate < "2027-01-31" || t.dueDate === "2027-01-31").toBe(true);
    }
  });
});

describe("addDays / overdue", () => {
  it("handles month and leap boundaries", () => {
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2027-06-12", -365)).toBe("2026-06-12");
  });
  it("overdue only for open tasks with a past due date", () => {
    expect(isTaskOverdue({ status: "todo", dueDate: "2027-01-01" }, "2027-01-02")).toBe(true);
    expect(isTaskOverdue({ status: "done", dueDate: "2027-01-01" }, "2027-01-02")).toBe(false);
    expect(isTaskOverdue({ status: "todo", dueDate: null }, "2027-01-02")).toBe(false);
    expect(isTaskOverdue({ status: "todo", dueDate: "2027-01-02" }, "2027-01-02")).toBe(false);
    expect(isTaskOpen({ status: "in_progress", dueDate: null })).toBe(true);
    expect(isTaskOpen({ status: "cancelled", dueDate: null })).toBe(false);
  });
});
