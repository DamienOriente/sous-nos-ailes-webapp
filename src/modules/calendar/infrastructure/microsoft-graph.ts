import { TZDate } from "@date-fns/tz";
import type { NormalizedEvent } from "@/modules/calendar/domain/sync";
import { parseRRule, type ParsedRRule } from "@/modules/calendar/domain/rrule";
import { providerFetch, toForm, type CalendarProviderAdapter, type ExternalCalendar, type ExternalEvent, type FetchLike, type ListChangesResult, type TokenSet } from "./provider-adapter";

/**
 * Microsoft Graph adapter (Outlook / Microsoft 365 calendars).
 * Scopes: Calendars.ReadWrite + offline_access (refresh token). Incremental
 * sync uses calendarView/delta which yields occurrences; recurring series are
 * imported once through their series master.
 */
const GRAPH = "https://graph.microsoft.com/v1.0";

type GraphDateTime = { dateTime: string; timeZone: string };
type GraphEvent = {
  id: string;
  "@odata.etag"?: string;
  "@removed"?: { reason: string };
  iCalUId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType: string; content: string };
  location?: { displayName?: string };
  start?: GraphDateTime;
  end?: GraphDateTime;
  isAllDay?: boolean;
  isCancelled?: boolean;
  type?: "singleInstance" | "occurrence" | "exception" | "seriesMaster";
  seriesMasterId?: string;
  recurrence?: GraphRecurrence | null;
};
type GraphRecurrence = {
  pattern: { type: string; interval: number; daysOfWeek?: string[]; dayOfMonth?: number; index?: string; firstDayOfWeek?: string };
  range: { type: string; startDate: string; endDate?: string; numberOfOccurrences?: number; recurrenceTimeZone?: string };
};

export class MicrosoftGraphAdapter implements CalendarProviderAdapter {
  readonly provider = "microsoft" as const;
  readonly scopes = ["Calendars.ReadWrite", "offline_access"] as const;

  constructor(
    private readonly config: { clientId: string; clientSecret: string; tenant: string },
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private get authority() {
    return `https://login.microsoftonline.com/${encodeURIComponent(this.config.tenant)}/oauth2/v2.0`;
  }

  authorizationUrl(input: { state: string; codeChallenge: string; redirectUri: string }): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: input.redirectUri,
      response_mode: "query",
      scope: this.scopes.join(" "),
      state: input.state,
      code_challenge: input.codeChallenge,
      code_challenge_method: "S256",
    });
    return `${this.authority}/authorize?${params.toString()}`;
  }

  async exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<TokenSet> {
    const { body } = await providerFetch<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }>(this.fetchImpl, `${this.authority}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toForm({ client_id: this.config.clientId, client_secret: this.config.clientSecret, code: input.code, redirect_uri: input.redirectUri, grant_type: "authorization_code", code_verifier: input.codeVerifier, scope: this.scopes.join(" ") }),
    });
    if (!body?.access_token) throw new Error("Microsoft token response without access_token");
    return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null, expiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000), scopes: (body.scope ?? "").split(" ").filter(Boolean) };
  }

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const { body } = await providerFetch<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }>(this.fetchImpl, `${this.authority}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toForm({ client_id: this.config.clientId, client_secret: this.config.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token", scope: this.scopes.join(" ") }),
    });
    if (!body?.access_token) throw new Error("Microsoft refresh response without access_token");
    return { accessToken: body.access_token, refreshToken: body.refresh_token ?? refreshToken, expiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000), scopes: (body.scope ?? "").split(" ").filter(Boolean) };
  }

  /**
   * Microsoft identity platform has no per-token revocation endpoint usable
   * server side with these scopes; the user revokes the app from
   * myaccount.microsoft.com. We delete our copy of the tokens.
   */
  async revoke(): Promise<void> {
    return;
  }

  async listCalendars(accessToken: string): Promise<ExternalCalendar[]> {
    const { body } = await providerFetch<{ value?: Array<{ id: string; name: string; isDefaultCalendar?: boolean; canEdit?: boolean; owner?: { address?: string } }> }>(this.fetchImpl, `${GRAPH}/me/calendars?$select=id,name,isDefaultCalendar,canEdit,owner`, { accessToken });
    return (body?.value ?? []).filter((c) => c.canEdit !== false).map((c) => ({ id: c.id, name: c.name, primary: Boolean(c.isDefaultCalendar), ownerEmail: c.owner?.address ?? null }));
  }

  async listChanges(accessToken: string, calendarId: string, cursor: string | null, window: { from: Date; to: Date }): Promise<ListChangesResult> {
    const events: ExternalEvent[] = [];
    const seenMasters = new Set<string>();
    let url: string | null = cursor ?? `${GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/calendarView/delta?${toForm({ startDateTime: window.from.toISOString(), endDateTime: window.to.toISOString() })}`;
    let deltaLink: string | null = null;
    type DeltaPage = { value?: GraphEvent[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string };
    while (url) {
      const { body }: { body: DeltaPage | null } = await providerFetch<DeltaPage>(this.fetchImpl, url, { accessToken, headers: { Prefer: 'outlook.timezone="UTC"' } });
      for (const item of body?.value ?? []) {
        if (item["@removed"]) {
          events.push({ externalId: item.id, etag: null, icalUid: null, deleted: true, event: null });
          continue;
        }
        if (item.type === "occurrence" || item.type === "exception") {
          if (item.seriesMasterId && !seenMasters.has(item.seriesMasterId)) {
            seenMasters.add(item.seriesMasterId);
            const { body: master } = await providerFetch<GraphEvent>(this.fetchImpl, `${GRAPH}/me/events/${encodeURIComponent(item.seriesMasterId)}`, { accessToken, headers: { Prefer: 'outlook.timezone="UTC"' } });
            if (master) events.push(toExternalEvent(master));
          }
          continue;
        }
        events.push(toExternalEvent(item));
      }
      url = body?.["@odata.nextLink"] ?? null;
      deltaLink = body?.["@odata.deltaLink"] ?? deltaLink;
    }
    return { events, nextCursor: deltaLink };
  }

  async createEvent(accessToken: string, calendarId: string, event: NormalizedEvent): Promise<{ externalId: string; etag: string | null }> {
    const { body } = await providerFetch<GraphEvent>(this.fetchImpl, `${GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", accessToken, body: JSON.stringify(toGraphBody(event)) });
    if (!body?.id) throw new Error("Graph insert without id");
    return { externalId: body.id, etag: body["@odata.etag"] ?? null };
  }

  async updateEvent(accessToken: string, _calendarId: string, externalId: string, event: NormalizedEvent): Promise<{ etag: string | null }> {
    const { body } = await providerFetch<GraphEvent>(this.fetchImpl, `${GRAPH}/me/events/${encodeURIComponent(externalId)}`, { method: "PATCH", accessToken, body: JSON.stringify(toGraphBody(event)) });
    return { etag: body?.["@odata.etag"] ?? null };
  }

  async deleteEvent(accessToken: string, _calendarId: string, externalId: string): Promise<void> {
    await providerFetch(this.fetchImpl, `${GRAPH}/me/events/${encodeURIComponent(externalId)}`, { method: "DELETE", accessToken });
  }
}

const GRAPH_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const GRAPH_INDEX = ["first", "second", "third", "fourth", "last"] as const;

export function toGraphBody(e: NormalizedEvent): Record<string, unknown> {
  const fmt = (d: Date) => (e.allDay ? `${d.toISOString().slice(0, 10)}T00:00:00` : d.toISOString().replace("Z", ""));
  const body: Record<string, unknown> = {
    subject: e.title,
    body: { contentType: "text", content: e.description ?? "" },
    location: e.location ? { displayName: e.location } : undefined,
    isAllDay: e.allDay,
    start: { dateTime: fmt(e.startsAt), timeZone: e.allDay ? e.timezone : "UTC" },
    end: { dateTime: fmt(e.endsAt), timeZone: e.allDay ? e.timezone : "UTC" },
  };
  if (e.rrule) body.recurrence = rruleToGraphRecurrence(parseRRule(e.rrule), e.startsAt, e.timezone);
  return body;
}

export function rruleToGraphRecurrence(r: ParsedRRule, dtstart: Date, timezone: string): GraphRecurrence {
  const local = new TZDate(dtstart, timezone);
  const startDate = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
  let pattern: GraphRecurrence["pattern"];
  if (r.freq === "DAILY") pattern = { type: "daily", interval: r.interval };
  else if (r.freq === "WEEKLY") pattern = { type: "weekly", interval: r.interval, daysOfWeek: (r.byDay.length ? r.byDay.map((b) => b.weekday) : [local.getDay()]).map((d) => GRAPH_DAYS[d]!), firstDayOfWeek: "monday" };
  else if (r.byDay.length && r.byDay[0]!.ordinal !== null) {
    const b = r.byDay[0]!;
    pattern = { type: "relativeMonthly", interval: r.interval, daysOfWeek: [GRAPH_DAYS[b.weekday]!], index: b.ordinal! < 0 ? "last" : (GRAPH_INDEX[b.ordinal! - 1] ?? "first") };
  } else pattern = { type: "absoluteMonthly", interval: r.interval, dayOfMonth: r.byMonthDay[0] ?? local.getDate() };
  const range: GraphRecurrence["range"] = r.count
    ? { type: "numbered", startDate, numberOfOccurrences: r.count, recurrenceTimeZone: timezone }
    : r.until
      ? { type: "endDate", startDate, endDate: r.until.toISOString().slice(0, 10), recurrenceTimeZone: timezone }
      : { type: "noEnd", startDate, recurrenceTimeZone: timezone };
  return { pattern, range };
}

export function graphRecurrenceToRRule(rec: GraphRecurrence): string | null {
  const parts: string[] = [];
  const p = rec.pattern;
  const days = (p.daysOfWeek ?? []).map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][GRAPH_DAYS.indexOf(d.toLowerCase() as (typeof GRAPH_DAYS)[number])]).filter(Boolean);
  switch (p.type) {
    case "daily":
      parts.push("FREQ=DAILY");
      break;
    case "weekly":
      parts.push("FREQ=WEEKLY");
      if (days.length) parts.push(`BYDAY=${days.join(",")}`);
      break;
    case "absoluteMonthly":
      parts.push("FREQ=MONTHLY");
      if (p.dayOfMonth) parts.push(`BYMONTHDAY=${p.dayOfMonth}`);
      break;
    case "relativeMonthly": {
      parts.push("FREQ=MONTHLY");
      const idx = p.index === "last" ? -1 : GRAPH_INDEX.indexOf((p.index ?? "first") as (typeof GRAPH_INDEX)[number]) + 1;
      if (days[0]) parts.push(`BYDAY=${idx}${days[0]}`);
      break;
    }
    default:
      return null; // yearly & co: imported as single occurrence
  }
  if (p.interval && p.interval > 1) parts.push(`INTERVAL=${p.interval}`);
  if (rec.range.type === "numbered" && rec.range.numberOfOccurrences) parts.push(`COUNT=${rec.range.numberOfOccurrences}`);
  if (rec.range.type === "endDate" && rec.range.endDate) parts.push(`UNTIL=${rec.range.endDate.replace(/-/g, "")}T235959Z`);
  const rule = parts.join(";");
  try {
    parseRRule(rule);
    return rule;
  } catch {
    return null;
  }
}

function graphDate(d: GraphDateTime | undefined, allDay: boolean): Date | null {
  if (!d) return null;
  if (allDay) return new Date(`${d.dateTime.slice(0, 10)}T00:00:00Z`);
  // With Prefer: outlook.timezone="UTC", dateTime is UTC without Z.
  const iso = d.dateTime.endsWith("Z") ? d.dateTime : `${d.dateTime.replace(/(\.\d{3})\d+$/, "$1")}Z`;
  if (d.timeZone && d.timeZone !== "UTC") return new TZDate(d.dateTime.replace(/(\.\d{3})\d+$/, "$1"), d.timeZone);
  return new Date(iso);
}

export function toExternalEvent(item: GraphEvent): ExternalEvent {
  if (item.isCancelled || !item.start) return { externalId: item.id, etag: item["@odata.etag"] ?? null, icalUid: item.iCalUId ?? null, deleted: true, event: null };
  const allDay = Boolean(item.isAllDay);
  const startsAt = graphDate(item.start, allDay) ?? new Date(NaN);
  const endsAt = graphDate(item.end, allDay) ?? new Date(startsAt.getTime() + 3_600_000);
  const description = item.body?.contentType === "text" ? item.body.content?.trim() || null : item.bodyPreview?.trim() || null;
  return {
    externalId: item.id,
    etag: item["@odata.etag"] ?? null,
    icalUid: item.iCalUId ?? null,
    deleted: false,
    event: {
      title: item.subject?.trim() || "(sans titre)",
      description,
      location: item.location?.displayName?.trim() || null,
      startsAt,
      endsAt,
      allDay,
      timezone: item.recurrence?.range.recurrenceTimeZone && isIana(item.recurrence.range.recurrenceTimeZone) ? item.recurrence.range.recurrenceTimeZone : "Europe/Paris",
      rrule: item.recurrence ? graphRecurrenceToRRule(item.recurrence) : null,
    },
  };
}

function isIana(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
