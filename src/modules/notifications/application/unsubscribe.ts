import { env } from "@/lib/env";
import { hashToken, safeEqual } from "@/lib/crypto";

/**
 * One-click marketing opt-out without a session. The token is an HMAC of the
 * user id (keyed with the data key via hashToken): it cannot be forged and
 * carries no personal data. Transactional e-mails never include this link.
 */
export function marketingUnsubscribeToken(userId: string): string {
  return hashToken(`unsubscribe:marketing:${userId}`);
}

export function buildMarketingUnsubscribeUrl(userId: string): string {
  const url = new URL("/api/notifications/unsubscribe", env.APP_URL);
  url.searchParams.set("u", userId);
  url.searchParams.set("t", marketingUnsubscribeToken(userId));
  return url.toString();
}

export function verifyMarketingUnsubscribeToken(userId: string, token: string): boolean {
  if (!userId || !token || token.length !== 64) return false;
  return safeEqual(marketingUnsubscribeToken(userId), token);
}
