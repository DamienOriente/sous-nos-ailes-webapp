import type { NormalizedEvent } from "@/modules/calendar/domain/sync";

/**
 * Common contract implemented by the Google Calendar and Microsoft Graph
 * adapters. The sync engine only talks to this interface, which makes the
 * engine testable with a fake adapter and the adapters testable with a
 * mocked `fetch`.
 */
export type CalendarProvider = "google" | "microsoft";

export type TokenSet = { accessToken: string; refreshToken: string | null; expiresAt: Date; scopes: string[] };

export type ExternalCalendar = { id: string; name: string; primary: boolean; ownerEmail: string | null };

export type ExternalEvent = {
  externalId: string;
  etag: string | null;
  /** Stable iCalendar UID when the provider exposes one. */
  icalUid: string | null;
  deleted: boolean;
  event: NormalizedEvent | null;
};

export type ListChangesResult = { events: ExternalEvent[]; nextCursor: string | null };

export class ProviderAuthError extends Error {
  constructor(message = "Jeton expiré ou révoqué") {
    super(message);
    this.name = "ProviderAuthError";
  }
}
/** Thrown when the provider says the sync cursor is no longer valid (Google 410). */
export class ProviderCursorError extends Error {
  constructor() {
    super("Cursor invalid, full resync required");
    this.name = "ProviderCursorError";
  }
}

export interface CalendarProviderAdapter {
  readonly provider: CalendarProvider;
  readonly scopes: readonly string[];
  authorizationUrl(input: { state: string; codeChallenge: string; redirectUri: string }): string;
  exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  /** Best effort revocation at the provider. Never throws on provider errors. */
  revoke(token: string): Promise<void>;
  listCalendars(accessToken: string): Promise<ExternalCalendar[]>;
  /** Incremental listing. `cursor` null = initial full listing for the given window. */
  listChanges(accessToken: string, calendarId: string, cursor: string | null, window: { from: Date; to: Date }): Promise<ListChangesResult>;
  createEvent(accessToken: string, calendarId: string, event: NormalizedEvent, icalUid: string): Promise<{ externalId: string; etag: string | null }>;
  updateEvent(accessToken: string, calendarId: string, externalId: string, event: NormalizedEvent): Promise<{ etag: string | null }>;
  deleteEvent(accessToken: string, calendarId: string, externalId: string): Promise<void>;
}

export type FetchLike = typeof fetch;

/** Shared HTTP helper: JSON in/out, maps 401 → ProviderAuthError, 410 → ProviderCursorError. */
export async function providerFetch<T>(fetchImpl: FetchLike, url: string, init: RequestInit & { accessToken?: string } = {}): Promise<{ status: number; body: T | null; headers: Headers }> {
  const headers = new Headers(init.headers);
  if (init.accessToken) headers.set("Authorization", `Bearer ${init.accessToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  const res = await fetchImpl(url, { ...init, headers });
  if (res.status === 401) throw new ProviderAuthError();
  if (res.status === 410) throw new ProviderCursorError();
  if (res.status === 404 && init.method === "DELETE") return { status: 404, body: null, headers: res.headers };
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Provider error ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return { status: 204, body: null, headers: res.headers };
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as T) : null, headers: res.headers };
}

export function toForm(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}
