import { describe, expect, it, vi } from "vitest";
import { GoogleCalendarAdapter, toExternalEvent as googleToExternal, toGoogleBody } from "@/modules/calendar/infrastructure/google-calendar";
import { MicrosoftGraphAdapter, graphRecurrenceToRRule, rruleToGraphRecurrence, toGraphBody } from "@/modules/calendar/infrastructure/microsoft-graph";
import { ProviderAuthError, ProviderCursorError } from "@/modules/calendar/infrastructure/provider-adapter";
import { parseRRule } from "@/modules/calendar/domain/rrule";

/**
 * Contract tests with a mocked fetch. They verify request shapes (URLs,
 * methods, bodies, headers) and response mapping — NOT the behaviour of the
 * real APIs, which needs real credentials.
 */
type Call = { url: string; init: RequestInit };
function mockFetch(handler: (url: string, init: RequestInit) => { status?: number; body?: unknown } | undefined) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    const res = handler(url, init) ?? { status: 404, body: { error: "not mocked" } };
    const status = res.status ?? 200;
    const text = res.body === undefined ? "" : JSON.stringify(res.body);
    return new Response(status === 204 ? null : text, { status, headers: { "Content-Type": "application/json" } });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const event = { title: "Garde", description: "9 enfants", location: "Lavaur", startsAt: new Date("2027-06-12T13:00:00Z"), endsAt: new Date("2027-06-12T23:00:00Z"), allDay: false, timezone: "Europe/Paris", rrule: null };

describe("Google Calendar adapter", () => {
  const cfg = { clientId: "cid", clientSecret: "secret" };
  it("builds a PKCE authorization URL with minimal scopes", () => {
    const url = new URL(new GoogleCalendarAdapter(cfg).authorizationUrl({ state: "st", codeChallenge: "ch", redirectUri: "http://localhost:3200/api/integrations/google/callback" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly");
  });
  it("exchanges the code with the verifier and maps the token set", async () => {
    const { fn, calls } = mockFetch((url) => (url.includes("oauth2.googleapis.com/token") ? { body: { access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "a b" } } : undefined));
    const tokens = await new GoogleCalendarAdapter(cfg, fn).exchangeCode({ code: "c", codeVerifier: "v", redirectUri: "r" });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.scopes).toEqual(["a", "b"]);
    const body = new URLSearchParams(String(calls[0]!.init.body));
    expect(body.get("code_verifier")).toBe("v");
    expect(body.get("grant_type")).toBe("authorization_code");
  });
  it("lists calendars, maps primary → account e-mail", async () => {
    const { fn, calls } = mockFetch(() => ({ body: { items: [{ id: "theo@example.test", summary: "Théo", primary: true }, { id: "work", summary: "Pro" }] } }));
    const cals = await new GoogleCalendarAdapter(cfg, fn).listCalendars("tok");
    expect(cals[0]).toEqual({ id: "theo@example.test", name: "Théo", primary: true, ownerEmail: "theo@example.test" });
    expect(new Headers(calls[0]!.init.headers).get("Authorization")).toBe("Bearer tok");
  });
  it("lists changes with pagination + syncToken and maps cancelled / recurring events", async () => {
    const { fn, calls } = mockFetch((url) => {
      const u = new URL(url);
      if (u.searchParams.get("pageToken") === "p2") return { body: { items: [{ id: "e2", status: "cancelled" }], nextSyncToken: "sync-2" } };
      return {
        body: {
          items: [
            { id: "e1", etag: "\"1\"", iCalUID: "e1@google.com", summary: "Rdv", start: { dateTime: "2027-06-12T10:00:00+02:00", timeZone: "Europe/Paris" }, end: { dateTime: "2027-06-12T11:00:00+02:00" }, recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=SA"] },
            { id: "e1_20270619", recurringEventId: "e1", summary: "instance" },
          ],
          nextPageToken: "p2",
        },
      };
    });
    const res = await new GoogleCalendarAdapter(cfg, fn).listChanges("tok", "primary", "sync-1", { from: new Date(), to: new Date() });
    expect(calls).toHaveLength(2);
    expect(new URL(calls[0]!.url).searchParams.get("syncToken")).toBe("sync-1");
    expect(res.nextCursor).toBe("sync-2");
    expect(res.events).toHaveLength(2); // instance skipped
    expect(res.events[0]!.event?.rrule).toBe("FREQ=WEEKLY;BYDAY=SA");
    expect(res.events[0]!.event?.startsAt.toISOString()).toBe("2027-06-12T08:00:00.000Z");
    expect(res.events[1]!.deleted).toBe(true);
  });
  it("maps 401 → ProviderAuthError and 410 → ProviderCursorError", async () => {
    await expect(new GoogleCalendarAdapter(cfg, mockFetch(() => ({ status: 401, body: {} })).fn).listCalendars("x")).rejects.toBeInstanceOf(ProviderAuthError);
    await expect(new GoogleCalendarAdapter(cfg, mockFetch(() => ({ status: 410, body: {} })).fn).listChanges("x", "primary", "old", { from: new Date(), to: new Date() })).rejects.toBeInstanceOf(ProviderCursorError);
  });
  it("creates, updates and deletes with the expected payloads", async () => {
    const { fn, calls } = mockFetch((url, init) => {
      if (init.method === "POST") return { body: { id: "new1", etag: "\"e\"" } };
      if (init.method === "PATCH") return { body: { id: "new1", etag: "\"e2\"" } };
      if (init.method === "DELETE") return { status: 204 };
      return undefined;
    });
    const a = new GoogleCalendarAdapter(cfg, fn);
    const created = await a.createEvent("tok", "primary", event, "uid@sna");
    expect(created).toEqual({ externalId: "new1", etag: "\"e\"" });
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.summary).toBe("Garde");
    expect(body.iCalUID).toBe("uid@sna");
    expect(body.start).toEqual({ dateTime: "2027-06-12T13:00:00.000Z", timeZone: "Europe/Paris" });
    await a.updateEvent("tok", "primary", "new1", { ...event, rrule: "FREQ=DAILY;COUNT=2" });
    expect(JSON.parse(String(calls[1]!.init.body)).recurrence).toEqual(["RRULE:FREQ=DAILY;COUNT=2"]);
    await a.deleteEvent("tok", "primary", "new1");
    expect(calls[2]!.url).toMatch(/\/events\/new1$/);
    expect(toGoogleBody({ ...event, allDay: true }).start).toEqual({ date: "2027-06-12" });
    expect(googleToExternal({ id: "x", status: "cancelled" }).deleted).toBe(true);
  });
});

describe("Microsoft Graph adapter", () => {
  const cfg = { clientId: "cid", clientSecret: "secret", tenant: "common" };
  it("builds the authorize URL with Calendars.ReadWrite offline_access", () => {
    const url = new URL(new MicrosoftGraphAdapter(cfg).authorizationUrl({ state: "s", codeChallenge: "c", redirectUri: "r" }));
    expect(url.pathname).toBe("/common/oauth2/v2.0/authorize");
    expect(url.searchParams.get("scope")).toBe("Calendars.ReadWrite offline_access");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
  it("walks delta pages, imports series masters once and reports removals", async () => {
    const { fn, calls } = mockFetch((url) => {
      if (url.includes("/me/events/master1")) return { body: { id: "master1", subject: "Hebdo", type: "seriesMaster", start: { dateTime: "2027-06-12T08:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2027-06-12T09:00:00.0000000", timeZone: "UTC" }, recurrence: { pattern: { type: "weekly", interval: 1, daysOfWeek: ["saturday"] }, range: { type: "noEnd", startDate: "2027-06-12", recurrenceTimeZone: "Europe/Paris" } } } };
      if (url.includes("nextpage")) return { body: { value: [{ id: "gone", "@removed": { reason: "deleted" } }], "@odata.deltaLink": "https://graph.microsoft.com/delta?token=abc" } };
      return {
        body: {
          value: [
            { id: "single", subject: "Rdv", type: "singleInstance", start: { dateTime: "2027-06-12T10:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2027-06-12T11:00:00.0000000", timeZone: "UTC" }, location: { displayName: "Albi" }, body: { contentType: "text", content: "notes" } },
            { id: "occ1", type: "occurrence", seriesMasterId: "master1" },
            { id: "occ2", type: "occurrence", seriesMasterId: "master1" },
          ],
          "@odata.nextLink": "https://graph.microsoft.com/nextpage",
        },
      };
    });
    const res = await new MicrosoftGraphAdapter(cfg, fn).listChanges("tok", "cal1", null, { from: new Date("2027-01-01"), to: new Date("2028-01-01") });
    expect(calls[0]!.url).toContain("/me/calendars/cal1/calendarView/delta?");
    expect(new Headers(calls[0]!.init.headers).get("Prefer")).toBe('outlook.timezone="UTC"');
    expect(res.nextCursor).toBe("https://graph.microsoft.com/delta?token=abc");
    expect(res.events.map((e) => e.externalId)).toEqual(["single", "master1", "gone"]);
    expect(res.events[0]!.event?.startsAt.toISOString()).toBe("2027-06-12T10:00:00.000Z");
    expect(res.events[0]!.event?.location).toBe("Albi");
    expect(res.events[1]!.event?.rrule).toBe("FREQ=WEEKLY;BYDAY=SA");
    expect(res.events[2]!.deleted).toBe(true);
  });
  it("creates with a Graph body and converts RRULE ↔ recurrence patterns", async () => {
    const { fn, calls } = mockFetch(() => ({ body: { id: "ms1", "@odata.etag": "W/1" } }));
    const created = await new MicrosoftGraphAdapter(cfg, fn).createEvent("tok", "cal1", { ...event, rrule: "FREQ=MONTHLY;BYDAY=-1FR;COUNT=3" });
    expect(created.externalId).toBe("ms1");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.subject).toBe("Garde");
    expect(body.start).toEqual({ dateTime: "2027-06-12T13:00:00.000", timeZone: "UTC" });
    expect(body.recurrence.pattern).toEqual({ type: "relativeMonthly", interval: 1, daysOfWeek: ["friday"], index: "last" });
    expect(body.recurrence.range).toMatchObject({ type: "numbered", numberOfOccurrences: 3, startDate: "2027-06-12" });
    expect(toGraphBody({ ...event, allDay: true }).isAllDay).toBe(true);
    expect(graphRecurrenceToRRule({ pattern: { type: "weekly", interval: 2, daysOfWeek: ["monday", "wednesday"] }, range: { type: "endDate", startDate: "2027-01-04", endDate: "2027-03-01" } })).toBe("FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=2;UNTIL=20270301T235959Z");
    expect(graphRecurrenceToRRule({ pattern: { type: "absoluteYearly", interval: 1 }, range: { type: "noEnd", startDate: "2027-01-04" } })).toBeNull();
    const back = rruleToGraphRecurrence(parseRRule("FREQ=DAILY;INTERVAL=3;UNTIL=20271231T235959Z"), new Date("2027-06-12T13:00:00Z"), "Europe/Paris");
    expect(back.pattern).toEqual({ type: "daily", interval: 3 });
    expect(back.range).toMatchObject({ type: "endDate", endDate: "2027-12-31" });
  });
  it("refreshes tokens with the refresh grant and reports 401 as auth errors", async () => {
    const { fn, calls } = mockFetch((url) => (url.endsWith("/token") ? { body: { access_token: "new", refresh_token: "r2", expires_in: 3599 } } : { status: 401 }));
    const a = new MicrosoftGraphAdapter(cfg, fn);
    const t = await a.refreshToken("r1");
    expect(t.accessToken).toBe("new");
    expect(new URLSearchParams(String(calls[0]!.init.body)).get("grant_type")).toBe("refresh_token");
    await expect(a.listCalendars("bad")).rejects.toBeInstanceOf(ProviderAuthError);
  });
});
