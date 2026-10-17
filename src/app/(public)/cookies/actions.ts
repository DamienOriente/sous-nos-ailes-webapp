"use server";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { isProduction } from "@/lib/env";
import { toActionError, type ActionResult } from "@/lib/errors";
import { getActor } from "@/lib/session";
import { track } from "@/modules/analytics/application/track";
import { recordCookieConsent } from "@/modules/privacy/application/consent-service";
import { CONSENT_COOKIE_NAME, CONSENT_MAX_AGE_SECONDS, CONSENT_POLICY_VERSION, parseConsent, serializeConsent, type ConsentChoices, type ConsentState } from "@/modules/privacy/domain/consent";

const choicesSchema = z.object({ analytics: z.boolean(), marketing: z.boolean() });

/**
 * Persists the visitor's cookie choice: cookie for the browser, proof row in
 * consent_records. Works for anonymous visitors and signed-in users alike.
 */
export async function saveCookieConsent(input: ConsentChoices): Promise<ActionResult<ConsentState>> {
  const parsed = choicesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choix invalide.", code: "validation" };
  try {
    const jar = await cookies();
    const h = await headers();
    const previous = parseConsent(jar.get(CONSENT_COOKIE_NAME)?.value);
    const actor = await getActor();
    const state: ConsentState = {
      anonymousId: previous?.anonymousId ?? randomUUID(),
      version: CONSENT_POLICY_VERSION,
      choices: parsed.data,
      decidedAt: new Date().toISOString(),
    };
    await recordCookieConsent({
      anonymousId: state.anonymousId,
      userId: actor?.userId ?? null,
      choices: parsed.data,
      previous: previous?.choices ?? null,
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
      userAgent: h.get("user-agent"),
    });
    jar.set(CONSENT_COOKIE_NAME, serializeConsent(state), {
      maxAge: CONSENT_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      httpOnly: false, // read client-side to decide whether to show the banner
      secure: isProduction,
    });
    await track("consent.updated", { analytics: parsed.data.analytics, marketing: parsed.data.marketing }, { userId: actor?.userId ?? null, anonymousId: state.anonymousId, analyticsConsent: parsed.data.analytics });
    return { ok: true, data: state };
  } catch (e) {
    return toActionError(e);
  }
}

/** Forgets the stored choice so the banner asks again (used from the account page). */
export async function resetCookieConsent(): Promise<ActionResult<undefined>> {
  try {
    const jar = await cookies();
    jar.delete(CONSENT_COOKIE_NAME);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
