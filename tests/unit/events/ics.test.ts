import { describe, expect, it } from "vitest";
import { buildIcsCalendar, escapeIcsText, foldIcsLine, formatIcsUtc } from "@/modules/events/infrastructure/ics";

describe("ics generator", () => {
  it("escapes special characters", () => {
    expect(escapeIcsText("a;b,c\\d\nnew")).toBe("a\\;b\\,c\\\\d\\nnew");
  });
  it("formats UTC timestamps", () => {
    expect(formatIcsUtc(new Date("2027-06-12T13:00:00Z"))).toBe("20270612T130000Z");
  });
  it("folds long lines at 75 octets", () => {
    const folded = foldIcsLine("X".repeat(160));
    const lines = folded.split("\r\n");
    expect(lines[0]!.length).toBe(75);
    expect(lines[1]!.startsWith(" ")).toBe(true);
    expect(lines.map((l, i) => (i === 0 ? l : l.slice(1))).join("").length).toBe(160);
  });
  it("builds a calendar with an all-day event and timed milestones", () => {
    const ics = buildIcsCalendar({
      name: "Mariage; test",
      now: new Date("2026-10-17T10:00:00Z"),
      events: [
        { uid: "event-1@sousnosailes.fr", summary: "Mariage de Louis et Lisa", allDay: true, start: "2027-06-12", stamp: new Date("2026-10-17T10:00:00Z") },
        { uid: "milestone-1@sousnosailes.fr", summary: "Cérémonie, parc", start: new Date("2027-06-12T13:00:00Z"), end: new Date("2027-06-12T14:00:00Z"), location: "Le parc", stamp: new Date("2026-10-17T10:00:00Z") },
      ],
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Mariage\\; test");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270612\r\nDTEND;VALUE=DATE:20270613");
    expect(ics).toContain("DTSTART:20270612T130000Z\r\nDTEND:20270612T140000Z");
    expect(ics).toContain("SUMMARY:Cérémonie\\, parc");
    expect(ics).toContain("LOCATION:Le parc");
    expect(ics.trim().endsWith("END:VCALENDAR")).toBe(true);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
  });
});
