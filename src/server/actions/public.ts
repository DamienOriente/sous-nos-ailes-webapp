"use server";

import { rateLimit } from "@/lib/rate-limit";
import { getClientKey } from "@/lib/request-meta";
import { submitApplication, submitContactMessage } from "@/server/services/applications";
import { contactMessageSchema, partnerApplicationSchema, providerApplicationSchema } from "@/validation/forms";
import { fieldErrorsOf, formDataToObject } from "@/validation/common";
import { errorState, successState, type ActionState } from "@/server/action-state";
import { userMessageFor } from "@/server/errors";
import { log } from "@/lib/logger";
import { getEnv } from "@/lib/env";

/** Strips the honeypot and the privacy acknowledgement before persisting. */
function withoutAntiAbuse<T extends { website?: string; privacyAccepted: "on" }>(data: T): Omit<T, "website" | "privacyAccepted"> {
  const copy: Record<string, unknown> = { ...data };
  delete copy.website;
  delete copy.privacyAccepted;
  return copy as Omit<T, "website" | "privacyAccepted">;
}

async function guard(scope: string, limit: number): Promise<ActionState | null> {
  const key = await getClientKey();
  // Relaxed locally so demos and test runs are not throttled.
  const result = rateLimit({ key: `${scope}:${key}`, limit: getEnv().DEMO_MODE ? 100 : limit, windowMs: 60 * 60_000 });
  if (!result.ok) return errorState("Trop d’envois en peu de temps. Réessayez dans quelques minutes.");
  return null;
}

export async function sendContactMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const blocked = await guard("contact", 5);
  if (blocked) return blocked;
  const parsed = contactMessageSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Vérifiez les champs signalés.", fieldErrorsOf(parsed.error));
  try {
    await submitContactMessage(withoutAntiAbuse(parsed.data));
    return successState("Votre message est bien envoyé. Marie vous répondra personnellement.");
  } catch (error) {
    log.error("contact.failed", { reason: error instanceof Error ? error.name : "unknown" });
    return errorState(userMessageFor(error));
  }
}

export async function sendProviderApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const blocked = await guard("application", 3);
  if (blocked) return blocked;
  const parsed = providerApplicationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Vérifiez les champs signalés.", fieldErrorsOf(parsed.error));
  try {
    await submitApplication("PROVIDER", withoutAntiAbuse(parsed.data));
    return successState("Merci ! Votre candidature est enregistrée. Marie vous recontactera pour un premier échange.");
  } catch (error) {
    log.error("application.failed", { reason: error instanceof Error ? error.name : "unknown" });
    return errorState(userMessageFor(error));
  }
}

export async function sendPartnerApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const blocked = await guard("application", 3);
  if (blocked) return blocked;
  const parsed = partnerApplicationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Vérifiez les champs signalés.", fieldErrorsOf(parsed.error));
  try {
    await submitApplication("PARTNER", withoutAntiAbuse(parsed.data));
    return successState("Merci ! Votre demande de partenariat est enregistrée. Marie vous recontactera.");
  } catch (error) {
    log.error("application.failed", { reason: error instanceof Error ? error.name : "unknown" });
    return errorState(userMessageFor(error));
  }
}
