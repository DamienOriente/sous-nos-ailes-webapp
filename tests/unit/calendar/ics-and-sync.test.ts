import { describe, expect, it } from "vitest";
import { conflictingEntryIds, detectConflicts } from "@/modules/calendar/domain/conflicts";
import { escapeIcsText, foldLine, generateIcs, unescapeIcsText, validateParsedEvent } from "@/modules/calendar/domain/ics";
import { decideSync, fingerprint } from "@/modules/calendar/domain/sync";
import { parseIcsText } from "@/modules/calendar/application/ics-import";

describe("conflict detection", () => {
  const at = (h: number, m = 0) => new Date(Date.UTC(2027, 5, 12, h, m));
  it("flags overlapping busy entries of the same owner and ignores informational kinds", () => {
    const conflicts = detectConflicts([
      { entryId: "a", kind: "service", start: at(10), end: at(14), title: "Garde" },
      { entryId: "b", kind: "event", start: at(13), end: at(18), title: "Mariage" },
      { entryId: "c", kind: "availability", start: at(9), end: at(20), title: "Dispo" },
      { entryId: "d", kind: "service", start: at(14), end: at(16), title: "Suite" }, // touches a, no overlap
    ]);
    expect(conflicts).toHaveLength(2); // a/b and b/d
    expect([...conflictingEntryIds(conflicts)].sort()).toEqual(["a", "b", "d"]);
  });
  it("does not report an entry against its own other occurrences", () => {
    expect(detectConflicts([{ entryId: "a", kind: "service", start: at(10), end: at(12), title: "x" }, { entryId: "a", kind: "service", start: at(11), end: at(13), title: "x" }])).toEqual([]);
  });
});

describe("ICS generation", () => {
  it("escapes text and folds long lines", () => {
    expect(escapeIcsText("a;b,c\nd\\e")).toBe("a\\;b\\,c\\nd\\\\e");
    expect(unescapeIcsText("a\\;b\\,c\\nd\\\\e")).toBe("a;b,c\nd\\e");
    const folded = foldLine("DESCRIPTION:" + "é".repeat(100));
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(Buffer.byteLength(l, "utf8")).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((l) => l.startsWith(" "))).toBe(true);
  });
  it("generates a calendar that round-trips through the parser", () => {
    const ics = generateIcs(
      [
        { uid: "u1@sna", title: "Prestation garde, mariage", description: "Ligne 1\nLigne 2", location: "Lavaur", startsAt: new Date("2027-06-12T12:00:00Z"), endsAt: new Date("2027-06-12T22:00:00Z"), allDay: false, timezone: "Europe/Paris", rrule: null, exdates: [] },
        { uid: "u2@sna", title: "Fermé le lundi", description: null, location: null, startsAt: new Date("2027-01-04T08:00:00Z"), endsAt: new Date("2027-01-04T17:00:00Z"), allDay: false, timezone: "Europe/Paris", rrule: "FREQ=WEEKLY;BYDAY=MO", exdates: ["2027-01-11T08:00:00.000Z"] },
        { uid: "u3@sna", title: "Journée", description: null, location: null, startsAt: new Date("2027-06-12T00:00:00Z"), endsAt: new Date("2027-06-13T00:00:00Z"), allDay: true, timezone: "Europe/Paris", rrule: null, exdates: [] },
      ],
      { calendarName: "Test", now: new Date("2026-10-17T10:00:00Z") },
    );
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("SUMMARY:Prestation garde\\, mariage");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:20270104T090000");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270612");
    const parsed = parseIcsText(ics);
    expect(parsed.errors).toEqual([]);
    expect(parsed.events).toHaveLength(3);
    const first = parsed.events.find((e) => e.uid === "u1@sna")!;
    expect(first.title).toBe("Prestation garde, mariage");
    expect(first.description).toBe("Ligne 1\nLigne 2");
    expect(first.startsAt.toISOString()).toBe("2027-06-12T12:00:00.000Z");
    const rec = parsed.events.find((e) => e.uid === "u2@sna")!;
    expect(rec.rrule).toContain("FREQ=WEEKLY");
    expect(rec.rrule).toContain("BYDAY=MO");
    expect(rec.startsAt.toISOString()).toBe("2027-01-04T08:00:00.000Z");
    const allDay = parsed.events.find((e) => e.uid === "u3@sna")!;
    expect(allDay.allDay).toBe(true);
  });
  it("rejects garbage and oversized files", () => {
    expect(parseIcsText("not an ics").errors.length).toBeGreaterThan(0);
    expect(parseIcsText("x".repeat(1_048_577)).errors[0]).toMatch(/1 Mo/);
    expect(validateParsedEvent({ uid: "a", title: "t", description: null, location: null, startsAt: new Date("2027-01-02T00:00:00Z"), endsAt: new Date("2027-01-01T00:00:00Z"), allDay: false, timezone: "UTC", rrule: null, exdates: [] })).toMatch(/précède/);
  });
  it("deduplicates by UID, keeping the last definition", () => {
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:x", "BEGIN:VEVENT", "UID:dup", "DTSTAMP:20260101T000000Z", "DTSTART:20270101T100000Z", "DTEND:20270101T110000Z", "SUMMARY:A", "END:VEVENT", "BEGIN:VEVENT", "UID:dup", "DTSTAMP:20260101T000000Z", "DTSTART:20270101T100000Z", "DTEND:20270101T110000Z", "SUMMARY:B", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const parsed = parseIcsText(ics);
    expect(parsed.events).toHaveLength(1);
  });
});

describe("sync fingerprint & decisions", () => {
  const base = { title: "A", description: null, location: null, startsAt: new Date("2027-01-01T10:00:00Z"), endsAt: new Date("2027-01-01T11:00:00Z"), allDay: false, timezone: "Europe/Paris", rrule: null };
  it("is stable for equivalent payloads and changes on meaningful edits", () => {
    expect(fingerprint(base)).toBe(fingerprint({ ...base, title: " A ", description: "" }));
    expect(fingerprint(base)).not.toBe(fingerprint({ ...base, title: "B" }));
    expect(fingerprint(base)).not.toBe(fingerprint({ ...base, startsAt: new Date("2027-01-01T10:30:00Z") }));
  });
  it("decides push / pull / conflict according to origin and direction", () => {
    expect(decideSync({ origin: "internal", direction: "both", lastSynced: "f1", internal: "f1", external: "f1" })).toBe("noop");
    expect(decideSync({ origin: "internal", direction: "both", lastSynced: "f1", internal: "f2", external: "f1" })).toBe("push");
    expect(decideSync({ origin: "internal", direction: "both", lastSynced: "f1", internal: "f1", external: "f2" })).toBe("pull");
    expect(decideSync({ origin: "internal", direction: "both", lastSynced: "f1", internal: "f2", external: "f3" })).toBe("conflict_keep_internal");
    expect(decideSync({ origin: "external", direction: "both", lastSynced: "f1", internal: "f2", external: "f3" })).toBe("pull");
    expect(decideSync({ origin: "internal", direction: "export_only", lastSynced: "f1", internal: "f1", external: "f2" })).toBe("noop");
    expect(decideSync({ origin: "internal", direction: "import_only", lastSynced: "f1", internal: "f2", external: "f1" })).toBe("noop");
    // never synced: push new internal entry
    expect(decideSync({ origin: "internal", direction: "export_only", lastSynced: null, internal: "f1", external: null })).toBe("push");
    // external deleted
    expect(decideSync({ origin: "external", direction: "import_only", lastSynced: "f1", internal: "f1", external: null })).toBe("pull");
  });
});
