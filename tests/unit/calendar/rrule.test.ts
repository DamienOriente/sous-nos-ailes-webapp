import { describe, expect, it } from "vitest";
import { describeRRule, expandOccurrences, parseRRule, RRuleError } from "@/modules/calendar/domain/rrule";

const TZ = "Europe/Paris";
const parisLocal = (iso: string) => {
  // Returns the UTC instant for a Paris wall-clock time (handles DST via Intl).
  const [date, time] = iso.split("T") as [string, string];
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asIf = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour! % 24, +parts.minute!);
  return new Date(guess - (asIf - guess));
};
const parisClock = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);

describe("parseRRule", () => {
  it("parses a weekly rule with BYDAY, INTERVAL and COUNT", () => {
    const r = parseRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=5");
    expect(r.freq).toBe("WEEKLY");
    expect(r.interval).toBe(2);
    expect(r.byDay.map((b) => b.weekday)).toEqual([1, 3]);
    expect(r.count).toBe(5);
  });
  it("parses UNTIL and ordinal BYDAY for monthly rules", () => {
    const r = parseRRule("RRULE:FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20271231T225959Z");
    expect(r.byDay).toEqual([{ weekday: 5, ordinal: -1 }]);
    expect(r.until?.toISOString()).toBe("2027-12-31T22:59:59.000Z");
  });
  it("rejects unsupported frequencies and garbage", () => {
    expect(() => parseRRule("FREQ=YEARLY")).toThrow(RRuleError);
    expect(() => parseRRule("BYDAY=MO")).toThrow(RRuleError);
    expect(() => parseRRule("FREQ=WEEKLY;FOO=1")).toThrow(RRuleError);
  });
});

describe("expandOccurrences", () => {
  it("returns the entry itself when not recurring and overlapping the range", () => {
    const start = new Date("2027-06-12T08:00:00Z");
    const end = new Date("2027-06-12T22:00:00Z");
    expect(expandOccurrences({ dtstart: start, dtend: end, timezone: TZ, rrule: null, rangeStart: new Date("2027-06-01T00:00:00Z"), rangeEnd: new Date("2027-07-01T00:00:00Z") })).toEqual([{ start, end }]);
    expect(expandOccurrences({ dtstart: start, dtend: end, timezone: TZ, rrule: null, rangeStart: new Date("2027-07-01T00:00:00Z"), rangeEnd: new Date("2027-08-01T00:00:00Z") })).toEqual([]);
  });

  it("keeps the local wall-clock time across the March DST change (weekly, Europe/Paris)", () => {
    // Monday 2027-03-22 10:00 Paris (CET, UTC+1) → next Monday 2027-03-29 is after the switch to CEST (UTC+2).
    const dtstart = parisLocal("2027-03-22T10:00");
    const dtend = parisLocal("2027-03-22T12:00");
    expect(dtstart.toISOString()).toBe("2027-03-22T09:00:00.000Z");
    const occ = expandOccurrences({ dtstart, dtend, timezone: TZ, rrule: "FREQ=WEEKLY;BYDAY=MO", rangeStart: new Date("2027-03-20T00:00:00Z"), rangeEnd: new Date("2027-04-10T00:00:00Z") });
    expect(occ.map((o) => o.start.toISOString())).toEqual(["2027-03-22T09:00:00.000Z", "2027-03-29T08:00:00.000Z", "2027-04-05T08:00:00.000Z"]);
    expect(occ.map((o) => parisClock(o.start))).toEqual(["10:00", "10:00", "10:00"]);
    expect(occ.every((o) => o.end.getTime() - o.start.getTime() === 2 * 3_600_000)).toBe(true);
  });

  it("keeps the local wall-clock time across the October DST change (daily)", () => {
    const dtstart = parisLocal("2027-10-30T09:30"); // Saturday, CEST
    const dtend = parisLocal("2027-10-30T10:00");
    const occ = expandOccurrences({ dtstart, dtend, timezone: TZ, rrule: "FREQ=DAILY;COUNT=3", rangeStart: new Date("2027-10-01T00:00:00Z"), rangeEnd: new Date("2027-12-01T00:00:00Z") });
    expect(occ.map((o) => o.start.toISOString())).toEqual(["2027-10-30T07:30:00.000Z", "2027-10-31T08:30:00.000Z", "2027-11-01T08:30:00.000Z"]);
    expect(occ.map((o) => parisClock(o.start))).toEqual(["09:30", "09:30", "09:30"]);
  });

  it("honours COUNT, UNTIL and EXDATE", () => {
    const dtstart = parisLocal("2027-01-04T09:00");
    const dtend = parisLocal("2027-01-04T18:00");
    const range = { rangeStart: new Date("2026-12-01T00:00:00Z"), rangeEnd: new Date("2028-01-01T00:00:00Z") };
    const counted = expandOccurrences({ dtstart, dtend, timezone: TZ, rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=4", ...range });
    expect(counted).toHaveLength(4);
    const until = expandOccurrences({ dtstart, dtend, timezone: TZ, rrule: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20270125T235959Z", ...range });
    expect(until.map((o) => o.start.toISOString().slice(0, 10))).toEqual(["2027-01-04", "2027-01-11", "2027-01-18", "2027-01-25"]);
    const excluded = expandOccurrences({ dtstart, dtend, timezone: TZ, rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=4", exdates: [parisLocal("2027-01-11T09:00").toISOString()], ...range });
    expect(excluded.map((o) => o.start.toISOString().slice(0, 10))).toEqual(["2027-01-04", "2027-01-18", "2027-01-25"]);
  });

  it("expands weekly rules with several BYDAY and INTERVAL=2 from the first week", () => {
    const dtstart = parisLocal("2027-05-05T14:00"); // Wednesday
    const dtend = parisLocal("2027-05-05T15:00");
    const occ = expandOccurrences({ dtstart, dtend, timezone: TZ, rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR", rangeStart: new Date("2027-05-01T00:00:00Z"), rangeEnd: new Date("2027-05-31T00:00:00Z") });
    // Week of May 3: Wed 5 & Fri 7 (Mon 3 is before dtstart); then week of May 17: Mon 17, Wed 19, Fri 21.
    expect(occ.map((o) => o.start.toISOString().slice(0, 10))).toEqual(["2027-05-05", "2027-05-07", "2027-05-17", "2027-05-19", "2027-05-21"]);
  });

  it("expands monthly rules by ordinal weekday and by month day, skipping short months", () => {
    const dtstart = parisLocal("2027-01-30T10:00");
    const dtend = parisLocal("2027-01-30T11:00");
    const range = { rangeStart: new Date("2027-01-01T00:00:00Z"), rangeEnd: new Date("2027-06-01T00:00:00Z") };
    const byMonthDay = expandOccurrences({ dtstart, dtend, timezone: TZ, rrule: "FREQ=MONTHLY", ...range });
    expect(byMonthDay.map((o) => o.start.toISOString().slice(0, 10))).toEqual(["2027-01-30", "2027-03-30", "2027-04-30", "2027-05-30"]);
    const lastFriday = expandOccurrences({ dtstart: parisLocal("2027-01-29T10:00"), dtend: parisLocal("2027-01-29T11:00"), timezone: TZ, rrule: "FREQ=MONTHLY;BYDAY=-1FR", ...range });
    expect(lastFriday.map((o) => o.start.toISOString().slice(0, 10))).toEqual(["2027-01-29", "2027-02-26", "2027-03-26", "2027-04-30", "2027-05-28"]);
  });

  it("only returns occurrences overlapping the requested window", () => {
    const dtstart = parisLocal("2027-01-04T09:00");
    const dtend = parisLocal("2027-01-04T18:00");
    const occ = expandOccurrences({ dtstart, dtend, timezone: TZ, rrule: "FREQ=WEEKLY;BYDAY=MO", rangeStart: new Date("2027-03-01T00:00:00Z"), rangeEnd: new Date("2027-03-15T00:00:00Z") });
    expect(occ.map((o) => o.start.toISOString().slice(0, 10))).toEqual(["2027-03-01", "2027-03-08"]);
  });
});

describe("describeRRule", () => {
  it("produces a French summary", () => {
    expect(describeRRule("FREQ=WEEKLY;BYDAY=MO")).toBe("Toutes les semaines le lundi");
    expect(describeRRule("FREQ=DAILY;INTERVAL=2;COUNT=3")).toBe("Tous les jours (tous les 2), 3 fois");
    expect(describeRRule(null)).toBeNull();
  });
});
