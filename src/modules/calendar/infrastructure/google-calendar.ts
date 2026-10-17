import type { NormalizedEvent } from "@/modules/calendar/domain/sync";
import { parseRRule } from "@/modules/calendar/domain/rrule";
import { providerFetch, toForm, type CalendarProviderAdapter, type ExternalCalendar, type ExternalEvent, type FetchLike, type ListChangesResult, type TokenSet } from "./provider-adapter";

/**
 * Google Calendar v3 adapter. Scopes are the minimum for the feature set:
 * events read/write on the chosen calendar + read-only calendar list (to pick
 * the target calendar and learn the account e-mail = primary calendar id).
 */
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";

type GoogleEvent = {
  id: string;
  etag?: string;
  iCalUID?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
  recurringEventId?: string;
};

export class GoogleCalendarAdapter implements CalendarProviderAdapter {
  readonly provider = "google" as const;
  readonly scopes = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.calendarlist.readonly"] as const;

  constructor(
    private readonly config: { clientId: string; clientSecret: string },
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  authorizationUrl(input: { state: string; codeChallenge: string; redirectUri: string }): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: input.redirectUri,
      response_type: "code",
      scope: this.scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "false",
      state: input.state,
      code_challenge: input.codeChallenge,
      code_challenge_method: "S256",
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<TokenSet> {
    const { body } = await providerFetch<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }>(this.fetchImpl, TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toForm({ code: input.code, client_id: this.config.clientId, client_secret: this.config.clientSecret, redirect_uri: input.redirectUri, grant_type: "authorization_code", code_verifier: input.codeVerifier }),
    });
    if (!body?.access_token) throw new Error("Google token response without access_token");
    return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null, expiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000), scopes: (body.scope ?? "").split(" ").filter(Boolean) };
  }

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const { body } = await providerFetch<{ access_token: string; expires_in: number; scope?: string }>(this.fetchImpl, TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toForm({ refresh_token: refreshToken, client_id: this.config.clientId, client_secret: this.config.clientSecret, grant_type: "refresh_token" }),
    });
    if (!body?.access_token) throw new Error("Google refresh response without access_token");
    return { accessToken: body.access_token, refreshToken, expiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000), scopes: (body.scope ?? "").split(" ").filter(Boolean) };
  }

  async revoke(token: string): Promise<void> {
    try {
      await this.fetchImpl(`${REVOKE_URL}?${toForm({ token })}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    } catch {
      // best effort: tokens are deleted locally regardless
    }
  }

  async listCalendars(accessToken: string): Promise<ExternalCalendar[]> {
    const { body } = await providerFetch<{ items?: Array<{ id: string; summary?: string; primary?: boolean; accessRole?: string }> }>(this.fetchImpl, `${API}/users/me/calendarList?minAccessRole=writer`, { accessToken });
    return (body?.items ?? []).map((c) => ({ id: c.id, name: c.summary ?? c.id, primary: Boolean(c.primary), ownerEmail: c.primary ? c.id : null }));
  }

  async listChanges(accessToken: string, calendarId: string, cursor: string | null, window: { from: Date; to: Date }): Promise<ListChangesResult> {
    const events: ExternalEvent[] = [];
    let pageToken: string | null = null;
    let nextSyncToken: string | null = null;
    do {
      const params = new URLSearchParams({ maxResults: "250", showDeleted: "true", singleEvents: "false" });
      if (cursor) params.set("syncToken", cursor);
      else {
        params.set("timeMin", window.from.toISOString());
        params.set("timeMax", window.to.toISOString());
      }
      if (pageToken) params.set("pageToken", pageToken);
      const { body } = await providerFetch<{ items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>(this.fetchImpl, `${API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, { accessToken });
      for (const item of body?.items ?? []) {
        if (item.recurringEventId) continue; // instances are covered by the master's RRULE
        events.push(toExternalEvent(item));
      }
      pageToken = body?.nextPageToken ?? null;
      nextSyncToken = body?.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
    return { events, nextCursor: nextSyncToken };
  }

  async createEvent(accessToken: string, calendarId: string, event: NormalizedEvent, icalUid: string): Promise<{ externalId: string; etag: string | null }> {
    const { body } = await providerFetch<GoogleEvent>(this.fetchImpl, `${API}/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", accessToken, body: JSON.stringify({ ...toGoogleBody(event), iCalUID: icalUid }) });
    if (!body?.id) throw new Error("Google insert without id");
    return { externalId: body.id, etag: body.etag ?? null };
  }

  async updateEvent(accessToken: string, calendarId: string, externalId: string, event: NormalizedEvent): Promise<{ etag: string | null }> {
    const { body } = await providerFetch<GoogleEvent>(this.fetchImpl, `${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}`, { method: "PATCH", accessToken, body: JSON.stringify(toGoogleBody(event)) });
    return { etag: body?.etag ?? null };
  }

  async deleteEvent(accessToken: string, calendarId: string, externalId: string): Promise<void> {
    await providerFetch(this.fetchImpl, `${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}`, { method: "DELETE", accessToken });
  }
}

export function toGoogleBody(e: NormalizedEvent): Record<string, unknown> {
  const body: Record<string, unknown> = { summary: e.title, description: e.description ?? undefined, location: e.location ?? undefined };
  if (e.allDay) {
    body.start = { date: e.startsAt.toISOString().slice(0, 10) };
    body.end = { date: e.endsAt.toISOString().slice(0, 10) };
  } else {
    body.start = { dateTime: e.startsAt.toISOString(), timeZone: e.timezone };
    body.end = { dateTime: e.endsAt.toISOString(), timeZone: e.timezone };
  }
  body.recurrence = e.rrule ? [`RRULE:${e.rrule}`] : undefined;
  return body;
}

export function toExternalEvent(item: GoogleEvent): ExternalEvent {
  if (item.status === "cancelled" || !item.start) return { externalId: item.id, etag: item.etag ?? null, icalUid: item.iCalUID ?? null, deleted: true, event: null };
  const allDay = Boolean(item.start.date);
  const startsAt = new Date(item.start.dateTime ?? `${item.start.date}T00:00:00Z`);
  const endsAt = new Date(item.end?.dateTime ?? (item.end?.date ? `${item.end.date}T00:00:00Z` : startsAt.getTime() + 3_600_000));
  let rrule: string | null = null;
  const rr = item.recurrence?.find((l) => l.toUpperCase().startsWith("RRULE:"));
  if (rr) {
    const candidate = rr.slice(6);
    try {
      parseRRule(candidate);
      rrule = candidate;
    } catch {
      rrule = null; // unsupported rule: imported as a single occurrence
    }
  }
  return {
    externalId: item.id,
    etag: item.etag ?? null,
    icalUid: item.iCalUID ?? null,
    deleted: false,
    event: { title: item.summary?.trim() || "(sans titre)", description: item.description ?? null, location: item.location ?? null, startsAt, endsAt, allDay, timezone: item.start.timeZone ?? "Europe/Paris", rrule },
  };
}
