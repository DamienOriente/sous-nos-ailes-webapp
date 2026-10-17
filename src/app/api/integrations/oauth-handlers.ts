import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAppError, PaymentRequiredError } from "@/lib/errors";
import { env, isProduction } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getActor } from "@/lib/session";
import type { CalendarProvider } from "@/modules/calendar/infrastructure/provider-adapter";
import { beginOAuth, completeOAuth, OAUTH_STATE_TTL_MS, requireCalendarSyncEntitlement, verifyOAuthCookie } from "@/modules/calendar/application/connections-service";

/**
 * Shared implementation of /api/integrations/<provider>/{start,callback}.
 * The state + PKCE verifier travel in a signed HttpOnly cookie bound to the
 * user; the callback verifies signature, state, user and TTL before
 * exchanging the code.
 */
const cookieName = (provider: CalendarProvider) => `sna_oauth_${provider}`;
const CONNECTIONS = "/app/calendrier/connexions";

function redirectWithError(message: string) {
  return NextResponse.redirect(new URL(`${CONNECTIONS}?error=${encodeURIComponent(message)}`, env.APP_URL));
}

export async function handleOAuthStart(provider: CalendarProvider): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.redirect(new URL(`/connexion?next=${encodeURIComponent(CONNECTIONS)}`, env.APP_URL));
  try {
    await requireCalendarSyncEntitlement(actor);
    const { url, cookieValue } = beginOAuth(actor, provider);
    const res = NextResponse.redirect(url);
    res.cookies.set(cookieName(provider), cookieValue, { httpOnly: true, sameSite: "lax", secure: isProduction, path: "/api/integrations", maxAge: Math.floor(OAUTH_STATE_TTL_MS / 1000) });
    return res;
  } catch (e) {
    if (e instanceof PaymentRequiredError) return NextResponse.redirect(new URL(CONNECTIONS, env.APP_URL));
    if (isAppError(e)) return redirectWithError(e.message);
    throw e;
  }
}

export async function handleOAuthCallback(provider: CalendarProvider, request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.redirect(new URL(`/connexion?next=${encodeURIComponent(CONNECTIONS)}`, env.APP_URL));
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const cookieValue = jar.get(cookieName(provider))?.value;
  const clear = (res: NextResponse) => {
    res.cookies.set(cookieName(provider), "", { httpOnly: true, sameSite: "lax", secure: isProduction, path: "/api/integrations", maxAge: 0 });
    return res;
  };
  if (providerError) return clear(redirectWithError(providerError === "access_denied" ? "Autorisation refusée chez le fournisseur." : "Le fournisseur a renvoyé une erreur."));
  if (!code || !state) return clear(redirectWithError("Réponse OAuth incomplète."));
  try {
    const payload = verifyOAuthCookie(cookieValue, { state, provider, userId: actor.userId });
    await completeOAuth(actor, provider, code, payload.verifier);
    return clear(NextResponse.redirect(new URL(`${CONNECTIONS}?connected=${provider}`, env.APP_URL)));
  } catch (e) {
    logger.warn({ provider, err: e instanceof Error ? e.message : String(e) }, "oauth callback failed");
    return clear(redirectWithError(isAppError(e) ? e.message : "Connexion impossible : réessayez."));
  }
}
