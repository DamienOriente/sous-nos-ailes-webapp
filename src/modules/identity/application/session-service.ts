import { auth } from "@/lib/auth";
import { toSessionViews, type SessionView } from "@/modules/identity/domain/security";

/**
 * Session queries go through better-auth: with `secondaryStorage` configured,
 * sessions live in Redis, not in the `sessions` table. Kept apart from
 * security-service so the better-auth plugin can import that one without a
 * circular dependency on `@/lib/auth`.
 *
 * Tokens never leave the server: the UI only receives session ids.
 */
export async function listMySessions(headers: Headers, currentSessionId: string): Promise<SessionView[]> {
  const raw = await auth.api.listSessions({ headers });
  return toSessionViews(raw, currentSessionId);
}

/** Resolves the token of one of the caller's own sessions by id, for better-auth's revoke endpoint. */
export async function findMySessionToken(headers: Headers, sessionId: string): Promise<string | null> {
  const raw = await auth.api.listSessions({ headers });
  return raw.find((s) => s.id === sessionId)?.token ?? null;
}
