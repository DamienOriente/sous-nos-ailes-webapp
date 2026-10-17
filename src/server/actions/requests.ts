"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/rate-limit";
import { getEnv } from "@/lib/env";
import { getClientKey } from "@/lib/request-meta";
import { log } from "@/lib/logger";
import { submitEventRequest } from "@/server/services/event-requests";
import { eventRequestSchema } from "@/validation/event-request";
import { fieldErrorsOf, formDataToObject } from "@/validation/common";
import { errorState, type ActionState } from "@/server/action-state";
import { userMessageFor } from "@/server/errors";
import type { ReferralSourceKind } from "@/generated/prisma/enums";

const REFERRAL_COOKIE = "lpi_ref";

function parseReferralCookie(value: string | undefined): { code: string; kind: ReferralSourceKind } | null {
  if (!value) return null;
  const [code, via] = decodeURIComponent(value).split(".");
  if (!code) return null;
  return { code, kind: via === "qr" ? "QR" : "LINK" };
}

export async function submitQuoteRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const clientKey = await getClientKey();
  // 10 requests per hour per client in real use; relaxed locally so demos and test runs are not throttled.
  const limit = rateLimit({ key: `request:${clientKey}`, limit: getEnv().DEMO_MODE ? 100 : 10, windowMs: 60 * 60_000 });
  if (!limit.ok) return errorState("Trop de demandes envoyées en peu de temps. Réessayez dans quelques minutes ou écrivez-nous.");

  const raw = formDataToObject(formData);
  // Checkboxes named optionCodes[] arrive as an array; a single one as a string.
  if (typeof raw.optionCodes === "string") raw.optionCodes = [raw.optionCodes];
  if (raw.optionCodes === undefined) raw.optionCodes = [];
  const parsed = eventRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return errorState("Certaines réponses doivent être corrigées.", fieldErrorsOf(parsed.error));
  }

  const store = await cookies();
  const referral = parseReferralCookie(store.get(REFERRAL_COOKIE)?.value);
  let reference: string;
  try {
    const result = await submitEventRequest(parsed.data, { referralCode: referral?.code ?? null, referralSourceKind: referral?.kind });
    reference = result.reference;
  } catch (error) {
    log.error("request.submit.failed", { reason: error instanceof Error ? error.name : "unknown" });
    return errorState(userMessageFor(error));
  }
  redirect(`/demander-un-devis/merci?ref=${encodeURIComponent(reference)}`);
}
