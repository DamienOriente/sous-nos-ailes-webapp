"use client";
import { CONSENT_COOKIE_NAME, isConsentCurrent, parseConsent, type ConsentState } from "@/modules/privacy/domain/consent";

/** Browser-side read of the consent cookie (not HttpOnly on purpose). */
export function readConsentCookie(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE_NAME}=`))
    ?.slice(CONSENT_COOKIE_NAME.length + 1);
  if (!raw) return null;
  try {
    return parseConsent(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

export function hasCurrentConsent(): boolean {
  return isConsentCurrent(readConsentCookie());
}

/** Fired after a choice is saved so every mounted consent UI refreshes. */
export const CONSENT_EVENT = "sna:consent-updated";

export function broadcastConsentUpdate(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONSENT_EVENT));
}
