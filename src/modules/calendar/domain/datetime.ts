import { TZDate } from "@date-fns/tz";

/**
 * Helpers shared by forms: an <input type="datetime-local"> yields a wall
 * clock string without offset; we interpret it in the user's time zone.
 */
export function parseLocalDateTime(value: string | null | undefined, timeZone: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
  const date = new TZDate(+y!, +mo! - 1, +d!, +h, +mi, +s, timeZone);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getTime());
}

/** Inverse: Date → "YYYY-MM-DDTHH:mm" in the given zone, for input default values. */
export function toLocalInputValue(date: Date | null | undefined, timeZone: string): string {
  if (!date) return "";
  const z = new TZDate(date, timeZone);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${z.getFullYear()}-${p(z.getMonth() + 1)}-${p(z.getDate())}T${p(z.getHours())}:${p(z.getMinutes())}`;
}

export function toLocalDateValue(date: Date, timeZone: string): string {
  return toLocalInputValue(date, timeZone).slice(0, 10);
}

export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatLongDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** Start of day / week (Monday) / month in a zone, returned as UTC instants. */
export function startOfDayTz(date: Date, timeZone: string): Date {
  const z = new TZDate(date, timeZone);
  return new Date(new TZDate(z.getFullYear(), z.getMonth(), z.getDate(), timeZone).getTime());
}
export function addDaysTz(date: Date, days: number, timeZone: string): Date {
  const z = new TZDate(date, timeZone);
  return new Date(new TZDate(z.getFullYear(), z.getMonth(), z.getDate() + days, z.getHours(), z.getMinutes(), timeZone).getTime());
}
export function startOfWeekTz(date: Date, timeZone: string): Date {
  const z = new TZDate(date, timeZone);
  const offset = (z.getDay() + 6) % 7;
  return new Date(new TZDate(z.getFullYear(), z.getMonth(), z.getDate() - offset, timeZone).getTime());
}
export function startOfMonthTz(date: Date, timeZone: string): Date {
  const z = new TZDate(date, timeZone);
  return new Date(new TZDate(z.getFullYear(), z.getMonth(), 1, timeZone).getTime());
}
export function addMonthsTz(date: Date, months: number, timeZone: string): Date {
  const z = new TZDate(date, timeZone);
  return new Date(new TZDate(z.getFullYear(), z.getMonth() + months, 1, timeZone).getTime());
}
export function dayKey(date: Date, timeZone: string): string {
  return toLocalDateValue(date, timeZone);
}
