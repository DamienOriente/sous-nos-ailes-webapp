import { describe, expect, it } from "vitest";
import { canSendReminder } from "@/modules/invitations/domain/reminders";
import { acceptsResponse, canTransition, computeRsvpExpiry, isTerminal, statusAfterAnswer, statusAfterView } from "@/modules/invitations/domain/state";
import { isTemplateAllowed } from "@/modules/invitations/domain/templates";

describe("invitation state machine", () => {
  it("only moves forward", () => {
    expect(canTransition("draft", "sent")).toBe(true);
    expect(canTransition("sent", "viewed")).toBe(true);
    expect(canTransition("viewed", "answered")).toBe(true);
    expect(canTransition("answered", "sent")).toBe(false);
    expect(canTransition("sent", "draft")).toBe(false);
  });
  it("revoked and expired are terminal, reachable from everywhere else", () => {
    for (const s of ["draft", "sent", "viewed", "answered"] as const) {
      expect(canTransition(s, "revoked")).toBe(true);
      expect(canTransition(s, "expired")).toBe(true);
    }
    expect(canTransition("revoked", "sent")).toBe(false);
    expect(canTransition("expired", "answered")).toBe(false);
    expect(isTerminal("revoked")).toBe(true);
    expect(isTerminal("viewed")).toBe(false);
  });
  it("view/answer helpers never regress", () => {
    expect(statusAfterView("sent")).toBe("viewed");
    expect(statusAfterView("answered")).toBe("answered");
    expect(statusAfterView("revoked")).toBe("revoked");
    expect(statusAfterAnswer("draft")).toBe("answered");
    expect(statusAfterAnswer("expired")).toBe("expired");
    expect(acceptsResponse("viewed")).toBe(true);
    expect(acceptsResponse("revoked")).toBe(false);
  });
  it("computes the RSVP expiry as event date + 7 days", () => {
    expect(computeRsvpExpiry("2027-06-12").toISOString()).toBe("2027-06-19T23:59:59.000Z");
    const now = new Date("2026-01-01T00:00:00Z");
    expect(computeRsvpExpiry(null, now).getTime()).toBe(now.getTime() + 365 * 86_400_000);
  });
});

describe("reminder policy", () => {
  const base = { status: "sent", reminderCount: 0, lastReminderAt: null, sentAt: new Date("2026-01-01T00:00:00Z"), recipientEmail: "a@b.fr" };
  it("allows a reminder 7 days after sending, at most twice", () => {
    expect(canSendReminder({ ...base, now: new Date("2026-01-03T00:00:00Z") })).toEqual({ ok: false, reason: "too_soon", retryAfter: new Date("2026-01-08T00:00:00Z") });
    expect(canSendReminder({ ...base, now: new Date("2026-01-09T00:00:00Z") })).toEqual({ ok: true });
    expect(canSendReminder({ ...base, reminderCount: 1, lastReminderAt: new Date("2026-01-09T00:00:00Z"), now: new Date("2026-01-12T00:00:00Z") })).toMatchObject({ ok: false, reason: "too_soon" });
    expect(canSendReminder({ ...base, reminderCount: 2, now: new Date("2026-03-01T00:00:00Z") })).toEqual({ ok: false, reason: "max_reached" });
  });
  it("refuses without e-mail or when already answered", () => {
    expect(canSendReminder({ ...base, recipientEmail: null })).toEqual({ ok: false, reason: "no_email" });
    expect(canSendReminder({ ...base, status: "answered", now: new Date("2026-02-01T00:00:00Z") })).toEqual({ ok: false, reason: "status" });
  });
});

describe("templates", () => {
  it("gates premium templates", () => {
    expect(isTemplateAllowed("classic", false)).toBe(true);
    expect(isTemplateAllowed("rustic", false)).toBe(false);
    expect(isTemplateAllowed("rustic", true)).toBe(true);
    expect(isTemplateAllowed("unknown", true)).toBe(false);
  });
});
