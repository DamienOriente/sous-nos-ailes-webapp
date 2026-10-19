import { authErrorMessage } from "@/modules/identity/domain/auth";

export type AuthClientError = { status?: number; code?: string; message?: string } | null | undefined;

export type AuthFailure = { message: string; retryUntil: number | null };

/**
 * Normalises a better-auth client error into a user message and, for 429,
 * the timestamp until which the user has to wait (from X-Retry-After).
 */
export function describeAuthFailure(error: AuthClientError, response?: Response | null): AuthFailure {
  const status = error?.status ?? response?.status;
  if (status === 429) {
    const header = response?.headers.get("X-Retry-After") ?? response?.headers.get("Retry-After");
    const seconds = header ? Number.parseInt(header, 10) : NaN;
    const wait = Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
    return { message: authErrorMessage(undefined, 429), retryUntil: Date.now() + wait * 1000 };
  }
  return { message: authErrorMessage(error?.code, status), retryUntil: null };
}

/** The destination requested before sign-in survives the 2FA full-page redirect through sessionStorage. */
const NEXT_KEY = "sna.auth.next";
export function rememberNextPath(path: string): void {
  try {
    window.sessionStorage.setItem(NEXT_KEY, path);
  } catch {
    // private mode / storage disabled: fall back to the default destination
  }
}
export function consumeNextPath(): string | null {
  try {
    const value = window.sessionStorage.getItem(NEXT_KEY);
    window.sessionStorage.removeItem(NEXT_KEY);
    return value;
  } catch {
    return null;
  }
}
