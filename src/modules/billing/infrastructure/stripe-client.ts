import Stripe from "stripe";
import { env, stripeConfigured } from "@/lib/env";

/**
 * Stripe SDK instance (test keys only until go-live). Null when no key is
 * configured: callers then switch to the explicitly labelled mock provider.
 * Tests mock this module to inject a fake client.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!stripeConfigured || !env.STRIPE_SECRET_KEY) return null;
  if (!client) client = new Stripe(env.STRIPE_SECRET_KEY, { appInfo: { name: "Sous Nos Ailes" }, maxNetworkRetries: 2, timeout: 20_000 });
  return client;
}

export function getStripeWebhookSecret(): string | null {
  return env.STRIPE_WEBHOOK_SECRET ?? null;
}

/** Signature verification only needs the SDK's crypto helpers, never a network call. */
export function stripeWebhooks(): Stripe["webhooks"] {
  return (getStripe() ?? new Stripe("sk_test_signature_only")).webhooks;
}
