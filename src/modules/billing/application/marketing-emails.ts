/**
 * Marketing e-mails policy (V1).
 *
 * There are NO automatic marketing e-mails in V1: no re-engagement, no upsell,
 * no "your event is over, subscribe for the next one". Transactional e-mails
 * (notifications, invitations, inquiries, payment alerts) are the only
 * automated messages. Any future marketing campaign requires:
 *   1. an explicit opt-in (`notification_preferences.marketing_emails`),
 *   2. a List-Unsubscribe header and a one-click unsubscribe link,
 *   3. a rule excluding accounts whose last event is completed (no commercial
 *      follow-up after an event has taken place),
 *   4. a legal review of the message.
 * This module exists so the rule is encoded in code, not only in a document.
 */
export const MARKETING_EMAILS_ENABLED = false as const;

export type MarketingCandidate = { marketingOptIn: boolean; lastEventStatus: string | null; lastEventEndsAt: Date | null };

/** Pure eligibility rule, kept for when a campaign is (consciously) enabled. */
export function isMarketingEligible(candidate: MarketingCandidate, now: Date = new Date()): boolean {
  if (!MARKETING_EMAILS_ENABLED) return false;
  if (!candidate.marketingOptIn) return false;
  if (candidate.lastEventStatus === "completed") return false;
  if (candidate.lastEventEndsAt && candidate.lastEventEndsAt.getTime() < now.getTime()) return false;
  return true;
}

export async function sendMarketingEmail(): Promise<never> {
  throw new Error("Marketing e-mails are disabled in V1 (see modules/billing/application/marketing-emails.ts)");
}
