// Time helpers. Storage is UTC; display is Europe/Paris. Date-only values are
// handled as civil dates (YYYY-MM-DD) and stored as UTC midnight (@db.Date).

export const PARIS_TZ = "Europe/Paris";

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Offset (minutes east of UTC) of `timeZone` at the given instant. */
export function getTimeZoneOffsetMinutes(instant: Date, timeZone: string = PARIS_TZ): number {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** "YYYY-MM-DD" -> Date at UTC midnight (what Prisma expects for @db.Date). */
export function parseDateOnly(value: string): Date {
  if (!isValidDateOnly(value)) throw new Error(`Invalid date-only value: ${value}`);
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date at UTC midnight (as returned for @db.Date) -> "YYYY-MM-DD". */
export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToDateOnly(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnlyString(date);
}

/**
 * Converts a civil date + time in `timeZone` to a UTC instant.
 * Non-existent local times (spring-forward gap) resolve to the post-transition offset;
 * ambiguous local times (fall-back) resolve to the first occurrence.
 */
export function zonedDateTimeToUtc(dateOnly: string, time: string, timeZone: string = PARIS_TZ): Date {
  if (!isValidTime(time)) throw new Error(`Invalid time value: ${time}`);
  if (!isValidDateOnly(dateOnly)) throw new Error(`Invalid date-only value: ${dateOnly}`);
  const [y, m, d] = dateOnly.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  const threeHours = 3 * 60 * 60_000;
  // Offsets in force shortly before and after the wall-clock instant: they differ only around a transition.
  const before = getTimeZoneOffsetMinutes(new Date(naiveUtc - threeHours), timeZone);
  const after = getTimeZoneOffsetMinutes(new Date(naiveUtc + threeHours), timeZone);
  const candidates = before === after ? [before] : [before, after];
  const valid = candidates.filter((offset) => getTimeZoneOffsetMinutes(new Date(naiveUtc - offset * 60_000), timeZone) === offset);
  if (valid.length === 1) return new Date(naiveUtc - valid[0] * 60_000);
  if (valid.length > 1) {
    // Ambiguous (fall-back): the first occurrence is the one with the larger offset.
    return new Date(naiveUtc - Math.max(...valid) * 60_000);
  }
  // Non-existent (spring-forward gap): slide forward using the pre-transition offset.
  return new Date(naiveUtc - before * 60_000);
}

export type EventInstants = { startsAt: Date; endsAt: Date; endDateOnly: string; crossesMidnight: boolean };

/**
 * Derives UTC instants for an event. When no end date is given and the end
 * time is not after the start time, the event is assumed to end the next day.
 */
export function computeEventInstants(input: {
  date: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  timeZone?: string;
}): EventInstants {
  const timeZone = input.timeZone ?? PARIS_TZ;
  const startsAt = zonedDateTimeToUtc(input.date, input.startTime, timeZone);
  let endDateOnly = input.endDate ?? input.date;
  if (!input.endDate && input.endTime <= input.startTime) {
    endDateOnly = addDaysToDateOnly(input.date, 1);
  }
  let endsAt = zonedDateTimeToUtc(endDateOnly, input.endTime, timeZone);
  if (endsAt.getTime() <= startsAt.getTime()) {
    // Explicit end date equal to start date with an earlier time: roll to next day.
    endDateOnly = addDaysToDateOnly(endDateOnly, 1);
    endsAt = zonedDateTimeToUtc(endDateOnly, input.endTime, timeZone);
  }
  return { startsAt, endsAt, endDateOnly, crossesMidnight: endDateOnly !== input.date };
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function durationMinutes(startsAt: Date, endsAt: Date): number {
  return Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));
}

// ---------------------------------------------------------------------------
// Formatting (French, Europe/Paris)
// ---------------------------------------------------------------------------

const longDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const parisDateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const parisTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TZ,
  hour: "2-digit",
  minute: "2-digit",
});

const parisDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Formats a civil date (UTC-midnight Date or "YYYY-MM-DD"). */
export function formatDateOnlyLong(value: Date | string | null | undefined): string {
  if (!value) return "Date à confirmer";
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  return longDateFormatter.format(date);
}

export function formatDateOnlyShort(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  return shortDateFormatter.format(date);
}

/** Formats an instant in Europe/Paris with date and time. */
export function formatInstantParis(instant: Date | null | undefined): string {
  if (!instant) return "—";
  return parisDateTimeFormatter.format(instant);
}

export function formatTimeParis(instant: Date | null | undefined): string {
  if (!instant) return "—";
  return parisTimeFormatter.format(instant);
}

export function formatInstantDateParis(instant: Date): string {
  return parisDateFormatter.format(instant);
}

/** "samedi 12 juin 2027, 18:00 → 01:30 (le lendemain)" */
export function formatEventWindow(input: {
  date: Date | string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  startTime?: string | null;
  endTime?: string | null;
  dateIsFlexible?: boolean;
}): string {
  const datePart = input.date ? formatDateOnlyLong(input.date) : "Date à confirmer";
  const flexible = input.dateIsFlexible ? " (date encore incertaine)" : "";
  if (input.startsAt && input.endsAt) {
    const start = formatTimeParis(input.startsAt);
    const end = formatTimeParis(input.endsAt);
    const startDay = toDateOnlyString(new Date(input.startsAt.getTime() + getTimeZoneOffsetMinutes(input.startsAt) * 60_000));
    const endDay = toDateOnlyString(new Date(input.endsAt.getTime() + getTimeZoneOffsetMinutes(input.endsAt) * 60_000));
    const nextDay = endDay !== startDay ? " (le lendemain)" : "";
    return `${datePart}${flexible}, ${start} → ${end}${nextDay}`;
  }
  if (input.startTime && input.endTime) {
    return `${datePart}${flexible}, ${input.startTime} → ${input.endTime}`;
  }
  return `${datePart}${flexible}`;
}

export function nowUtc(): Date {
  return new Date();
}
