/**
 * Pure rules for subscription lifecycle. No IO: imported by the webhook
 * processor, the entitlement service and the unit tests.
 */
export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Stripe uses the same vocabulary; anything unknown is treated as incomplete (no access). */
export function mapStripeStatus(status: string | null | undefined): SubscriptionStatus {
  if (status && (SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) return status as SubscriptionStatus;
  return "incomplete";
}

export type AccessInput = {
  status: SubscriptionStatus | string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * Whether a subscription still grants its features.
 * - active / trialing: yes (cancel_at_period_end keeps access until the period end:
 *   Stripe keeps the status "active" and sends customer.subscription.deleted later).
 * - past_due: grace period until the end of the already paid period.
 * - everything else: no.
 */
export function grantsAccess(sub: AccessInput, now: Date = new Date()): boolean {
  switch (sub.status) {
    case "active":
    case "trialing":
      return true;
    case "past_due":
      return sub.currentPeriodEnd ? sub.currentPeriodEnd.getTime() > now.getTime() : false;
    default:
      return false;
  }
}

export function unixToDate(seconds: number | null | undefined): Date | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000);
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Période d'essai",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Résilié",
  unpaid: "Impayé",
  incomplete: "En attente de paiement",
  incomplete_expired: "Paiement expiré",
  paused: "En pause",
};
