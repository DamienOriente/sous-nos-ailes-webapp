import { describe, expect, it } from "vitest";
import { grantsAccess, mapStripeStatus, unixToDate } from "@/modules/billing/domain/subscription-status";

describe("mapStripeStatus", () => {
  it("maps every Stripe status 1:1", () => {
    for (const s of ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) expect(mapStripeStatus(s)).toBe(s);
  });
  it("treats unknown or missing statuses as incomplete (no access)", () => {
    expect(mapStripeStatus("weird")).toBe("incomplete");
    expect(mapStripeStatus(null)).toBe("incomplete");
    expect(mapStripeStatus(undefined)).toBe("incomplete");
  });
});

describe("grantsAccess", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  const future = new Date("2026-11-01T00:00:00Z");
  const past = new Date("2026-10-01T00:00:00Z");
  it("active and trialing grant access", () => {
    expect(grantsAccess({ status: "active", currentPeriodEnd: future, cancelAtPeriodEnd: false }, now)).toBe(true);
    expect(grantsAccess({ status: "trialing", currentPeriodEnd: future, cancelAtPeriodEnd: false }, now)).toBe(true);
  });
  it("cancel_at_period_end keeps access until the period ends (status stays active)", () => {
    expect(grantsAccess({ status: "active", currentPeriodEnd: future, cancelAtPeriodEnd: true }, now)).toBe(true);
  });
  it("past_due keeps access only during the paid period", () => {
    expect(grantsAccess({ status: "past_due", currentPeriodEnd: future, cancelAtPeriodEnd: false }, now)).toBe(true);
    expect(grantsAccess({ status: "past_due", currentPeriodEnd: past, cancelAtPeriodEnd: false }, now)).toBe(false);
    expect(grantsAccess({ status: "past_due", currentPeriodEnd: null, cancelAtPeriodEnd: false }, now)).toBe(false);
  });
  it("canceled / unpaid / incomplete never grant access", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) expect(grantsAccess({ status, currentPeriodEnd: future, cancelAtPeriodEnd: false }, now)).toBe(false);
  });
});

describe("unixToDate", () => {
  it("converts seconds and rejects garbage", () => {
    expect(unixToDate(1_700_000_000)?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    expect(unixToDate(null)).toBeNull();
    expect(unixToDate(Number.NaN)).toBeNull();
  });
});
