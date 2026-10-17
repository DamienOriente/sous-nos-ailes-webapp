import { describe, expect, it } from "vitest";
import { decideTracking, isProductEventName, PRODUCT_EVENT_LABELS, PRODUCT_EVENTS, sanitizeProperties } from "@/modules/analytics/domain/events";

describe("product analytics consent gate", () => {
  it("tracks signed-in users as internal analytics", () => {
    expect(decideTracking({ userId: "u1", anonymousId: "anon", analyticsConsent: false })).toEqual({ track: true, userId: "u1", anonymousId: null });
  });

  it("tracks anonymous visitors only with analytics consent", () => {
    expect(decideTracking({ anonymousId: "anon", analyticsConsent: true })).toEqual({ track: true, userId: null, anonymousId: "anon" });
    expect(decideTracking({ anonymousId: "anon", analyticsConsent: false })).toEqual({ track: false });
    expect(decideTracking({ anonymousId: "anon" })).toEqual({ track: false });
    expect(decideTracking({})).toEqual({ track: false });
  });
});

describe("product event catalogue", () => {
  it("is closed and labelled", () => {
    for (const name of Object.keys(PRODUCT_EVENTS)) expect(PRODUCT_EVENT_LABELS[name as keyof typeof PRODUCT_EVENT_LABELS]).toBeTruthy();
    expect(isProductEventName("event.created")).toBe(true);
    expect(isProductEventName("child.health_viewed")).toBe(false);
  });

  it("drops undeclared properties and truncates strings so free text cannot leak", () => {
    const props = sanitizeProperties("directory.searched", { categorySlug: "traiteur", hasCity: true, resultsCount: 12, email: "x@y.z", notes: "allergie arachide", query: "a".repeat(500) });
    expect(props).toEqual({ categorySlug: "traiteur", hasCity: true, resultsCount: 12 });
    const long = sanitizeProperties("inquiry.sent", { kind: "q".repeat(200) });
    expect((long.kind as string).length).toBe(64);
    expect(sanitizeProperties("contact.sent", { anything: "x" })).toEqual({});
  });
});
