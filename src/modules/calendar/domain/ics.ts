import { TZDate } from "@date-fns/tz";

/**
 * ICS (RFC 5545) generation, pure. Parsing uses node-ical in the application
 * layer (it is a Node library); the normalisation of parsed events lives here
 * so it can be unit-tested.
 */
export type IcsEntry = {
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timezone: string;
  rrule: string | null;
  exdates: readonly string[];
  updatedAt?: Date;
  createdAt?: Date;
};

export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function unescapeIcsText(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

export function formatIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function formatIcsLocal(d: Date, tz: string): string {
  const z = new TZDate(d, tz);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${z.getFullYear()}${p(z.getMonth() + 1)}${p(z.getDate())}T${p(z.getHours())}${p(z.getMinutes())}${p(z.getSeconds())}`;
}

export function formatIcsDate(d: Date, tz: string): string {
  const z = new TZDate(d, tz);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${z.getFullYear()}${p(z.getMonth() + 1)}${p(z.getDate())}`;
}

/** RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF + space. */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    const max = out.length === 0 ? 75 : 74;
    if (currentBytes + b > max) {
      out.push(current);
      current = "";
      currentBytes = 0;
    }
    current += ch;
    currentBytes += b;
  }
  if (current) out.push(current);
  return out.join("\r\n ");
}

export function generateIcs(entries: readonly IcsEntry[], opts: { calendarName: string; prodId?: string; now?: Date }): string {
  const now = opts.now ?? new Date();
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${opts.prodId ?? "-//Sous Nos Ailes//Calendrier//FR"}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escapeIcsText(opts.calendarName)}`];
  for (const e of entries) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.uid}`);
    lines.push(`DTSTAMP:${formatIcsUtc(now)}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(e.startsAt, e.timezone)}`);
      lines.push(`DTEND;VALUE=DATE:${formatIcsDate(e.endsAt, e.timezone)}`);
    } else if (e.rrule) {
      // Recurring entries are exported as local time with TZID so the rule expands per local clock.
      lines.push(`DTSTART;TZID=${e.timezone}:${formatIcsLocal(e.startsAt, e.timezone)}`);
      lines.push(`DTEND;TZID=${e.timezone}:${formatIcsLocal(e.endsAt, e.timezone)}`);
    } else {
      lines.push(`DTSTART:${formatIcsUtc(e.startsAt)}`);
      lines.push(`DTEND:${formatIcsUtc(e.endsAt)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcsText(e.location)}`);
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    for (const ex of e.exdates) {
      const d = new Date(ex);
      if (!Number.isNaN(d.getTime())) lines.push(`EXDATE;TZID=${e.timezone}:${formatIcsLocal(d, e.timezone)}`);
    }
    if (e.createdAt) lines.push(`CREATED:${formatIcsUtc(e.createdAt)}`);
    if (e.updatedAt) lines.push(`LAST-MODIFIED:${formatIcsUtc(e.updatedAt)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Normalised event coming out of an ICS parser, before validation. */
export type ParsedIcsEvent = {
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timezone: string;
  rrule: string | null;
  exdates: string[];
};

export const MAX_ICS_BYTES = 1_048_576;

export function validateParsedEvent(e: ParsedIcsEvent): string | null {
  if (!e.uid || e.uid.length > 255) return "UID manquant ou trop long";
  if (!e.title || e.title.length > 500) return "Titre manquant ou trop long";
  if (Number.isNaN(e.startsAt.getTime()) || Number.isNaN(e.endsAt.getTime())) return "Dates invalides";
  if (e.endsAt.getTime() < e.startsAt.getTime()) return "La fin précède le début";
  if (e.endsAt.getTime() - e.startsAt.getTime() > 366 * 86_400_000) return "Durée supérieure à un an";
  if (e.description && e.description.length > 5000) return "Description trop longue";
  if (e.location && e.location.length > 500) return "Lieu trop long";
  return null;
}
