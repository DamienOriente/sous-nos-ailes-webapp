import { describe, expect, it } from "vitest";
import { eventObject, isHandledEventType, readInvoiceSubscriptionId, readSubscription } from "@/modules/billing/domain/billing-events";

describe("readSubscription", () => {
  it("reads the period from subscription items (Stripe API ≥ 2025-03)", () => {
    const snap = readSubscription({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: true,
      canceled_at: 1_700_000_000,
      metadata: { userId: "u1", planKey: "organizer_plus" },
      items: { data: [{ id: "si_1", price: { id: "price_1" }, current_period_start: 1_700_000_000, current_period_end: 1_702_592_000 }] },
    });
    expect(snap).toMatchObject({ id: "sub_1", customerId: "cus_1", status: "active", priceId: "price_1", currentPeriodStart: 1_700_000_000, currentPeriodEnd: 1_702_592_000, cancelAtPeriodEnd: true, canceledAt: 1_700_000_000, metadata: { userId: "u1", planKey: "organizer_plus" } });
  });
  it("falls back to root-level period fields (older payloads, mock)", () => {
    const snap = readSubscription({ id: "sub_2", customer: { id: "cus_2" }, status: "past_due", current_period_end: 123, cancel_at_period_end: false });
    expect(snap.customerId).toBe("cus_2");
    expect(snap.currentPeriodEnd).toBe(123);
    expect(snap.priceId).toBeNull();
  });
  it("ignores non-string metadata values", () => {
    expect(readSubscription({ id: "s", metadata: { a: "x", b: 2 } }).metadata).toEqual({ a: "x" });
  });
});

describe("readInvoiceSubscriptionId", () => {
  it("supports both the legacy field and parent.subscription_details", () => {
    expect(readInvoiceSubscriptionId({ subscription: "sub_a" })).toBe("sub_a");
    expect(readInvoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_b" } } })).toBe("sub_b");
    expect(readInvoiceSubscriptionId({})).toBeNull();
  });
});

describe("envelope helpers", () => {
  it("extracts data.object and knows handled types", () => {
    expect(eventObject({ data: { object: { id: "x" } } })).toEqual({ id: "x" });
    expect(eventObject({})).toEqual({});
    expect(isHandledEventType("checkout.session.completed")).toBe(true);
    expect(isHandledEventType("checkout.session.expired")).toBe(false);
  });
});
