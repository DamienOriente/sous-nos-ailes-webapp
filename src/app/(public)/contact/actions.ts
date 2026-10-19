"use server";
import { headers } from "next/headers";
import { toActionError, type ActionResult } from "@/lib/errors";
import { getActor } from "@/lib/session";
import { track } from "@/modules/analytics/application/track";
import { contactSchema, submitContactMessage } from "@/modules/legal/application/public-forms";
import { clientKeyFromHeaders } from "@/modules/legal/infrastructure/rate-limit";

/** Submitted values travel back with the error so the form keeps what the person typed (server-action forms reset). */
export type ContactFormState = ((ActionResult<{ delivered: true }>) & { values?: Record<string, string> }) | null;

export async function sendContactMessage(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const values = Object.fromEntries(["name", "email", "subject", "message"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = contactSchema.safeParse({ ...values, website: formData.get("website") ?? "" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: "Vérifiez les champs signalés.", code: "validation", fieldErrors, values };
  }
  try {
    const h = await headers();
    const actor = await getActor();
    await submitContactMessage(parsed.data, { clientKey: clientKeyFromHeaders(h), userId: actor?.userId ?? null });
    await track("contact.sent", {}, { userId: actor?.userId ?? null });
    return { ok: true, data: { delivered: true } };
  } catch (e) {
    return { ...toActionError(e), values };
  }
}
