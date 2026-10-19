"use server";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { toActionError, type ActionResult } from "@/lib/errors";
import { assertRateLimit } from "@/modules/identity/application/security-service";
import { env, isProduction } from "@/lib/env";
import { recordSignupConsents, setSignupNames } from "@/modules/identity/application/profile-service";
import { authErrorMessage, safeNextPath, signUpSchema } from "@/modules/identity/domain/auth";
import { fullName } from "@/modules/identity/domain/profile";

const VERIFICATION_CALLBACK = "/verification-email?statut=ok";

function clientIp(h: Headers): string | null {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

/**
 * Sign-up runs server-side (auth.api) so the legal consents are recorded
 * atomically with the account, with the real IP/user-agent, whether or not a
 * session is opened (production requires e-mail verification first).
 */
export async function signUpAction(input: unknown): Promise<ActionResult<{ next: string; requiresVerification: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    return { ok: false, error: "Vérifiez les champs du formulaire.", code: "validation", fieldErrors: Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v ?? []])) };
  }
  const h = await headers();
  const ip = clientIp(h);
  try {
    await assertRateLimit(`signup:${ip ?? "unknown"}`, isProduction || env.AUTH_RATE_LIMIT_STRICT ? 5 : 300, 60);
    const result = await auth.api.signUpEmail({
      body: {
        name: fullName(parsed.data.firstName, parsed.data.lastName),
        email: parsed.data.email,
        password: parsed.data.password,
        callbackURL: VERIFICATION_CALLBACK,
      },
      headers: h,
    });
    await recordSignupConsents(result.user.id, { ipAddress: ip, userAgent: h.get("user-agent") });
    // The user hook already created the profile row; store the split name now that we know it.
    await setSignupNames(result.user.id, parsed.data.firstName, parsed.data.lastName);
    return { ok: true, data: { next: safeNextPath(parsed.data.next, "/onboarding"), requiresVerification: result.token === null } };
  } catch (e) {
    if (e instanceof APIError) {
      const code = typeof e.body?.code === "string" ? e.body.code : undefined;
      logger.info({ code, status: e.statusCode }, "sign-up refused");
      return { ok: false, error: authErrorMessage(code, e.statusCode), code: e.statusCode === 429 ? "rate_limited" : "validation" };
    }
    logger.error({ err: e }, "sign-up failed");
    return toActionError(e);
  }
}
