import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { ingestBillingEvent } from "@/modules/billing/application/webhook-processor";
import { getStripeWebhookSecret, stripeWebhooks } from "@/modules/billing/infrastructure/stripe-client";
import { recordSecurityEvent } from "@/modules/admin/application/security-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe webhook endpoint. Raw body + signature verification with the webhook
 * secret; invalid signature → 400 + security event. Valid events go through the
 * idempotent ledger (replays are acknowledged with 200 and no side effect).
 * Processing failures return 500 so Stripe retries (the ledger row keeps the
 * error and allows reprocessing).
 */
export async function POST(request: Request) {
  const secret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!secret) {
    await recordSecurityEvent({ type: "webhook_unconfigured", severity: "medium", ipAddress: ip, details: { provider: "stripe" } });
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }
  const rawBody = await request.text();
  if (!signature) {
    await recordSecurityEvent({ type: "webhook_signature_invalid", severity: "medium", ipAddress: ip, details: { provider: "stripe", reason: "missing header" } });
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }
  let event;
  try {
    event = stripeWebhooks().constructEvent(rawBody, signature, secret);
  } catch (err) {
    await recordSecurityEvent({ type: "webhook_signature_invalid", severity: "medium", ipAddress: ip, details: { provider: "stripe", reason: err instanceof Error ? err.message.slice(0, 200) : "invalid" } });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  const result = await ingestBillingEvent({ provider: "stripe", externalEventId: event.id, type: event.type, payload: event as unknown as Record<string, unknown> });
  if (result.outcome === "failed") {
    logger.error({ eventId: event.id, type: event.type, error: result.error }, "stripe webhook processing failed");
    return NextResponse.json({ received: true, outcome: result.outcome }, { status: 500 });
  }
  return NextResponse.json({ received: true, outcome: result.outcome });
}
