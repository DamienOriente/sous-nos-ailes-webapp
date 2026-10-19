/**
 * Minimal RFC 5545 generator (VCALENDAR with VEVENTs). No external library:
 * we only need a handful of fields, and escaping/folding is straightforward.
 */
export type IcsEvent = {
  uid: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  /** All-day event when `allDay` is set: start/end are "YYYY-MM-DD". */
  allDay?: boolean;
  start: Date | string;
  end?: Date | string | null;
  /** Last modification (DTSTAMP). Defaults to now. */
  stamp?: Date;
};

export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function formatIcsUtc(date: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(date.getUTCFullYear(), 4)}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
}

function formatIcsDate(isoDate: string): string {
  return isoDate.slice(0, 10).replace(/-/g, "");
}

/** Lines longer than 75 octets are folded with CRLF + space (RFC 5545 §3.1). */
export function foldIcsLine(line: string): string {
  const out: string[] = [];
  let rest = line;
  let first = true;
  while (rest.length > 0) {
    const max = first ? 75 : 74;
    out.push((first ? "" : " ") + rest.slice(0, max));
    rest = rest.slice(max);
    first = false;
  }
  return out.join("\r\n");
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10))));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildIcsCalendar(input: { name: string; events: readonly IcsEvent[]; prodId?: string; now?: Date }): string {
  const now = input.now ?? new Date();
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${input.prodId ?? "-//Sous Nos Ailes//Planning//FR"}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escapeIcsText(input.name)}`];
  for (const ev of input.events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(ev.uid)}`);
    lines.push(`DTSTAMP:${formatIcsUtc(ev.stamp ?? now)}`);
    if (ev.allDay) {
      const start = typeof ev.start === "string" ? ev.start : ev.start.toISOString().slice(0, 10);
      const end = ev.end ? (typeof ev.end === "string" ? ev.end : ev.end.toISOString().slice(0, 10)) : addDaysIso(start, 1);
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(start)}`);
      lines.push(`DTEND;VALUE=DATE:${formatIcsDate(end)}`);
    } else {
      const start = typeof ev.start === "string" ? new Date(ev.start) : ev.start;
      lines.push(`DTSTART:${formatIcsUtc(start)}`);
      if (ev.end) lines.push(`DTEND:${formatIcsUtc(typeof ev.end === "string" ? new Date(ev.end) : ev.end)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(ev.summary)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
