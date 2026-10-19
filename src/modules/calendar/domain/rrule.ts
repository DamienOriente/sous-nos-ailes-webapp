import { TZDate } from "@date-fns/tz";

/**
 * Minimal RFC 5545 RRULE expander. Supports FREQ=DAILY|WEEKLY|MONTHLY,
 * INTERVAL, BYDAY (weekly: MO,TU…; monthly: 2SA, -1FR), BYMONTHDAY, COUNT,
 * UNTIL, plus EXDATE. Calculations happen in the entry's IANA time zone via
 * TZDate so a 10:00 weekly slot stays at 10:00 local across DST changes
 * (the UTC instant shifts by one hour, which is the expected behaviour).
 */
export type ParsedRRule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  byDay: Array<{ weekday: number; ordinal: number | null }>; // weekday 0=SU…6=SA
  byMonthDay: number[];
  count: number | null;
  until: Date | null;
};

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export class RRuleError extends Error {}

export function parseRRule(rule: string): ParsedRRule {
  const parts = rule
    .replace(/^RRULE:/i, "")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const out: ParsedRRule = { freq: "WEEKLY", interval: 1, byDay: [], byMonthDay: [], count: null, until: null };
  let hasFreq = false;
  for (const part of parts) {
    const [rawKey, rawValue] = part.split("=");
    const key = rawKey?.toUpperCase();
    const value = rawValue ?? "";
    switch (key) {
      case "FREQ":
        if (value !== "DAILY" && value !== "WEEKLY" && value !== "MONTHLY") throw new RRuleError(`Unsupported FREQ ${value}`);
        out.freq = value;
        hasFreq = true;
        break;
      case "INTERVAL": {
        const n = Number.parseInt(value, 10);
        if (!Number.isInteger(n) || n < 1 || n > 366) throw new RRuleError("Invalid INTERVAL");
        out.interval = n;
        break;
      }
      case "BYDAY":
        out.byDay = value.split(",").map((token) => {
          const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(token.trim());
          if (!m) throw new RRuleError(`Invalid BYDAY ${token}`);
          return { weekday: WEEKDAYS.indexOf(m[2]!.toUpperCase() as (typeof WEEKDAYS)[number]), ordinal: m[1] ? Number.parseInt(m[1], 10) : null };
        });
        break;
      case "BYMONTHDAY":
        out.byMonthDay = value.split(",").map((v) => {
          const n = Number.parseInt(v, 10);
          if (!Number.isInteger(n) || n === 0 || n < -31 || n > 31) throw new RRuleError("Invalid BYMONTHDAY");
          return n;
        });
        break;
      case "COUNT": {
        const n = Number.parseInt(value, 10);
        if (!Number.isInteger(n) || n < 1 || n > 1000) throw new RRuleError("Invalid COUNT");
        out.count = n;
        break;
      }
      case "UNTIL": {
        const d = parseIcalDate(value);
        if (!d) throw new RRuleError("Invalid UNTIL");
        out.until = d;
        break;
      }
      case "WKST":
        break; // Monday start is assumed for weekly expansion; WKST only matters for INTERVAL>1 with BYDAY spanning week boundaries.
      default:
        throw new RRuleError(`Unsupported rule part ${key}`);
    }
  }
  if (!hasFreq) throw new RRuleError("FREQ is required");
  return out;
}

/** 20270612T100000Z | 20270612T100000 | 20270612 → Date (UTC for Z / date-only). */
export function parseIcalDate(value: string, timeZone = "UTC"): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", z] = m;
  if (z || !m[4]) return new Date(Date.UTC(+y!, +mo! - 1, +d!, +h, +mi, +s));
  return new TZDate(+y!, +mo! - 1, +d!, +h, +mi, +s, timeZone);
}

export type Occurrence = { start: Date; end: Date };

export type ExpandInput = {
  dtstart: Date;
  dtend: Date;
  timezone: string;
  rrule: string | null;
  exdates?: readonly string[];
  rangeStart: Date;
  rangeEnd: Date;
  /** Safety cap on generated instances (defaults to 500). */
  limit?: number;
};

/**
 * Expands an entry into concrete occurrences overlapping [rangeStart, rangeEnd).
 * Non-recurring entries yield themselves when they overlap the range.
 */
export function expandOccurrences(input: ExpandInput): Occurrence[] {
  const duration = input.dtend.getTime() - input.dtstart.getTime();
  if (!input.rrule) {
    return overlaps(input.dtstart, input.dtend, input.rangeStart, input.rangeEnd) ? [{ start: input.dtstart, end: input.dtend }] : [];
  }
  const rule = parseRRule(input.rrule);
  const ex = new Set((input.exdates ?? []).map((d) => new Date(d).getTime()).filter((t) => !Number.isNaN(t)));
  const limit = input.limit ?? 500;
  const tz = input.timezone;
  const result: Occurrence[] = [];
  let produced = 0; // counts instances for COUNT, including those before the range and EXDATEd ones (RFC: EXDATE reduces the set after COUNT? No — COUNT counts generated instances; EXDATE removes from them.)

  const start = new TZDate(input.dtstart, tz);
  const hours = start.getHours();
  const minutes = start.getMinutes();
  const seconds = start.getSeconds();

  const push = (local: TZDate): boolean => {
    // returns false when generation must stop
    const occStart = new Date(local.getTime());
    if (rule.until && occStart.getTime() > rule.until.getTime()) return false;
    produced++;
    if (rule.count !== null && produced > rule.count) return false;
    if (occStart.getTime() >= input.rangeEnd.getTime()) return false;
    const occEnd = new Date(occStart.getTime() + duration);
    if (!ex.has(occStart.getTime()) && overlaps(occStart, occEnd, input.rangeStart, input.rangeEnd)) result.push({ start: occStart, end: occEnd });
    return result.length < limit;
  };

  const at = (y: number, m: number, d: number) => new TZDate(y, m, d, hours, minutes, seconds, tz);

  if (rule.freq === "DAILY") {
    let cursor = at(start.getFullYear(), start.getMonth(), start.getDate());
    for (let i = 0; i < 100_000; i++) {
      if (!push(cursor)) break;
      cursor = at(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + rule.interval);
    }
    return result;
  }

  if (rule.freq === "WEEKLY") {
    const weekdays = rule.byDay.length ? rule.byDay.map((b) => b.weekday).sort() : [start.getDay()];
    // Monday-based week start containing dtstart.
    const startWeekday = (start.getDay() + 6) % 7; // 0 = Monday
    let weekStart = at(start.getFullYear(), start.getMonth(), start.getDate() - startWeekday);
    outer: for (let w = 0; w < 100_000; w++) {
      for (const wd of weekdays) {
        const offset = (wd + 6) % 7;
        const candidate = at(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + offset);
        if (candidate.getTime() < start.getTime()) continue;
        if (!push(candidate)) break outer;
      }
      weekStart = at(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7 * rule.interval);
    }
    return result;
  }

  // MONTHLY
  let monthCursor = new TZDate(start.getFullYear(), start.getMonth(), 1, tz);
  outer2: for (let i = 0; i < 100_000; i++) {
    const y = monthCursor.getFullYear();
    const m = monthCursor.getMonth();
    const days: number[] = [];
    const daysInMonth = new TZDate(y, m + 1, 0, tz).getDate();
    if (rule.byDay.length) {
      for (const b of rule.byDay) {
        const matching: number[] = [];
        for (let d = 1; d <= daysInMonth; d++) if (new TZDate(y, m, d, tz).getDay() === b.weekday) matching.push(d);
        if (b.ordinal === null) days.push(...matching);
        else {
          const pick = b.ordinal > 0 ? matching[b.ordinal - 1] : matching[matching.length + b.ordinal];
          if (pick) days.push(pick);
        }
      }
    } else if (rule.byMonthDay.length) {
      for (const md of rule.byMonthDay) {
        const d = md > 0 ? md : daysInMonth + md + 1;
        if (d >= 1 && d <= daysInMonth) days.push(d);
      }
    } else {
      if (start.getDate() <= daysInMonth) days.push(start.getDate());
    }
    for (const d of [...new Set(days)].sort((a, b) => a - b)) {
      const candidate = at(y, m, d);
      if (candidate.getTime() < start.getTime()) continue;
      if (!push(candidate)) break outer2;
    }
    monthCursor = new TZDate(y, m + rule.interval, 1, tz);
  }
  return result;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

/** Human description used in the UI ("Toutes les semaines le lundi"). */
export function describeRRule(rule: string | null): string | null {
  if (!rule) return null;
  try {
    const r = parseRRule(rule);
    const dayNames = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    const every = r.interval === 1 ? "" : ` (tous les ${r.interval})`;
    const days = r.byDay.length ? ` le ${r.byDay.map((b) => (b.ordinal ? `${b.ordinal}ᵉ ` : "") + dayNames[b.weekday]).join(", ")}` : "";
    const base = r.freq === "DAILY" ? "Tous les jours" : r.freq === "WEEKLY" ? "Toutes les semaines" : "Tous les mois";
    const end = r.count ? `, ${r.count} fois` : r.until ? `, jusqu'au ${r.until.toLocaleDateString("fr-FR")}` : "";
    return `${base}${every}${days}${end}`;
  } catch {
    return rule;
  }
}
