import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { auditLogs, calendarConnections, calendarSyncJobs, professionals } from "@/db/schema";
import { decryptText, encryptText, hashToken, randomToken, safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireFeature } from "@/modules/billing/application/entitlements";
import { getProviderAdapter } from "@/modules/calendar/infrastructure/adapters";
import type { CalendarProvider, CalendarProviderAdapter, TokenSet } from "@/modules/calendar/infrastructure/provider-adapter";
import { SYNC_DIRECTIONS, type SyncDirection } from "@/modules/calendar/domain/constants";

export { SYNC_DIRECTIONS, SYNC_DIRECTION_LABELS, type SyncDirection } from "@/modules/calendar/domain/constants";

export const providerSchema = z.enum(["google", "microsoft"]);

/**
 * Entitlement rule for connectors: the feature `calendar.sync` is part of the
 * professional Premium plan. A user who owns no professional listing (pure
 * organiser) is not a customer of that plan: connectors are free for them.
 * A professional on the free plan hits the paywall.
 */
export async function requireCalendarSyncEntitlement(actor: Actor, executor: DbExecutor = db): Promise<void> {
  const [listing] = await executor.select({ id: professionals.id }).from(professionals).where(eq(professionals.ownerUserId, actor.userId)).limit(1);
  if (!listing) return;
  await requireFeature(actor, "professional", "calendar.sync", listing.id);
}

// ── OAuth 2.0 + PKCE ────────────────────────────────────────────────────────
export type OAuthStatePayload = { state: string; verifier: string; provider: CalendarProvider; userId: string; issuedAt: number };

export function redirectUriFor(provider: CalendarProvider): string {
  return new URL(`/api/integrations/${provider}/callback`, env.APP_URL).toString();
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Builds the provider authorization URL and the signed cookie value carrying state + PKCE verifier. */
export function beginOAuth(actor: Actor, provider: CalendarProvider): { url: string; cookieValue: string } {
  const adapter = getProviderAdapter(provider);
  if (!adapter) throw new ValidationError("Intégration non activée sur cette instance.");
  const payload: OAuthStatePayload = { state: randomToken(24), verifier: randomToken(48), provider, userId: actor.userId, issuedAt: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const cookieValue = `${encoded}.${hashToken(encoded)}`;
  const url = adapter.authorizationUrl({ state: payload.state, codeChallenge: pkceChallenge(payload.verifier), redirectUri: redirectUriFor(provider) });
  return { url, cookieValue };
}

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function verifyOAuthCookie(cookieValue: string | undefined, expected: { state: string; provider: CalendarProvider; userId: string }): OAuthStatePayload {
  if (!cookieValue) throw new ValidationError("Session OAuth expirée. Relancez la connexion.");
  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature || !safeEqual(hashToken(encoded), signature)) throw new ValidationError("État OAuth invalide.");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
  if (!safeEqual(payload.state, expected.state) || payload.provider !== expected.provider || payload.userId !== expected.userId) throw new ValidationError("État OAuth invalide.");
  if (Date.now() - payload.issuedAt > OAUTH_STATE_TTL_MS) throw new ValidationError("Session OAuth expirée. Relancez la connexion.");
  return payload;
}

/** Exchanges the code, discovers the primary calendar and stores the connection with encrypted tokens. */
export async function completeOAuth(actor: Actor, provider: CalendarProvider, code: string, verifier: string, adapter: CalendarProviderAdapter | null = getProviderAdapter(provider), executor: DbExecutor = db): Promise<{ id: string }> {
  if (!adapter) throw new ValidationError("Intégration non activée sur cette instance.");
  const tokens = await adapter.exchangeCode({ code, codeVerifier: verifier, redirectUri: redirectUriFor(provider) });
  const calendars = await adapter.listCalendars(tokens.accessToken);
  const primary = calendars.find((c) => c.primary) ?? calendars[0] ?? null;
  const values = {
    userId: actor.userId,
    provider,
    externalAccountEmail: primary?.ownerEmail ?? null,
    externalCalendarId: primary?.id ?? null,
    accessTokenEncrypted: encryptText(tokens.accessToken),
    refreshTokenEncrypted: tokens.refreshToken ? encryptText(tokens.refreshToken) : null,
    accessTokenExpiresAt: tokens.expiresAt,
    scopes: tokens.scopes.length ? tokens.scopes : [...adapter.scopes],
    status: "active" as const,
    syncCursor: null,
    lastError: null,
  };
  const [row] = await executor
    .insert(calendarConnections)
    .values(values)
    .onConflictDoUpdate({ target: [calendarConnections.userId, calendarConnections.provider], set: values })
    .returning({ id: calendarConnections.id });
  await executor.insert(auditLogs).values({ actorUserId: actor.userId, action: "calendar.connection_created", resourceType: "calendar_connection", resourceId: row!.id, metadata: { provider } });
  return { id: row!.id };
}

// ── Connections management ──────────────────────────────────────────────────
export async function listConnections(actor: Actor, executor: DbExecutor = db) {
  const rows = await executor.select().from(calendarConnections).where(eq(calendarConnections.userId, actor.userId));
  const jobs = rows.length
    ? await Promise.all(
        rows.map((c) => executor.select().from(calendarSyncJobs).where(eq(calendarSyncJobs.connectionId, c.id)).orderBy(desc(calendarSyncJobs.createdAt)).limit(5)),
      )
    : [];
  return rows.map((c, i) => ({
    id: c.id,
    provider: c.provider,
    externalAccountEmail: c.externalAccountEmail,
    externalCalendarId: c.externalCalendarId,
    status: c.status,
    syncDirection: c.syncDirection as SyncDirection,
    lastSyncAt: c.lastSyncAt,
    lastError: c.lastError,
    scopes: c.scopes,
    recentJobs: jobs[i] ?? [],
  }));
}

export async function requireOwnConnection(actor: Actor, connectionId: string, executor: DbExecutor = db) {
  const [c] = await executor
    .select()
    .from(calendarConnections)
    .where(and(eq(calendarConnections.id, connectionId), eq(calendarConnections.userId, actor.userId)))
    .limit(1);
  if (!c) throw new NotFoundError();
  return c;
}

export const connectionOptionsSchema = z.object({
  externalCalendarId: z.string().trim().min(1).max(500),
  syncDirection: z.enum(SYNC_DIRECTIONS),
});

export async function updateConnectionOptions(actor: Actor, connectionId: string, input: z.infer<typeof connectionOptionsSchema>, executor: DbExecutor = db): Promise<void> {
  const c = await requireOwnConnection(actor, connectionId, executor);
  // Changing the target calendar invalidates the incremental cursor.
  const resetCursor = c.externalCalendarId !== input.externalCalendarId;
  await executor
    .update(calendarConnections)
    .set({ externalCalendarId: input.externalCalendarId, syncDirection: input.syncDirection, ...(resetCursor ? { syncCursor: null } : {}) })
    .where(eq(calendarConnections.id, connectionId));
}

export async function listExternalCalendars(actor: Actor, connectionId: string, executor: DbExecutor = db) {
  const c = await requireOwnConnection(actor, connectionId, executor);
  const adapter = getProviderAdapter(c.provider);
  if (!adapter) return [];
  try {
    const token = await getFreshAccessToken(c, adapter, executor);
    return await adapter.listCalendars(token);
  } catch {
    return [];
  }
}

export async function disconnect(actor: Actor, connectionId: string, executor: DbExecutor = db): Promise<void> {
  const c = await requireOwnConnection(actor, connectionId, executor);
  const adapter = getProviderAdapter(c.provider);
  if (adapter) {
    const token = c.refreshTokenEncrypted ?? c.accessTokenEncrypted;
    if (token) await adapter.revoke(safeDecrypt(token) ?? "");
  }
  await executor.delete(calendarConnections).where(eq(calendarConnections.id, connectionId));
  await executor.insert(auditLogs).values({ actorUserId: actor.userId, action: "calendar.connection_deleted", resourceType: "calendar_connection", resourceId: connectionId, metadata: { provider: c.provider } });
}

function safeDecrypt(payload: string): string | null {
  try {
    return decryptText(payload);
  } catch {
    return null;
  }
}

/**
 * Returns a valid access token, refreshing it (and persisting the new
 * encrypted tokens) when it expires within a minute. Throws ForbiddenError
 * when no refresh is possible: the caller marks the connection expired.
 */
export async function getFreshAccessToken(c: typeof calendarConnections.$inferSelect, adapter: CalendarProviderAdapter, executor: DbExecutor = db): Promise<string> {
  const now = Date.now();
  const access = c.accessTokenEncrypted ? safeDecrypt(c.accessTokenEncrypted) : null;
  if (access && c.accessTokenExpiresAt && c.accessTokenExpiresAt.getTime() - now > 60_000) return access;
  const refresh = c.refreshTokenEncrypted ? safeDecrypt(c.refreshTokenEncrypted) : null;
  if (!refresh) throw new ForbiddenError("Jeton expiré : reconnectez le calendrier.");
  const tokens: TokenSet = await adapter.refreshToken(refresh);
  await executor
    .update(calendarConnections)
    .set({ accessTokenEncrypted: encryptText(tokens.accessToken), refreshTokenEncrypted: tokens.refreshToken ? encryptText(tokens.refreshToken) : c.refreshTokenEncrypted, accessTokenExpiresAt: tokens.expiresAt })
    .where(eq(calendarConnections.id, c.id));
  return tokens.accessToken;
}
