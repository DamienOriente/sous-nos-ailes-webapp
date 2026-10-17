import { describe, expect, it } from "vitest";
import { checkinUrl, evaluateToken, parseCheckinCode, rsvpUrl, type TokenRowLike } from "@/modules/invitations/domain/tokens";

const now = new Date("2027-06-12T15:00:00Z");
const base: TokenRowLike = { purpose: "checkin", expiresAt: new Date("2027-06-19T23:59:59Z"), revokedAt: null, maxUses: 1, useCount: 0, eventId: "evt-A", invitationStatus: "sent" };

describe("evaluateToken", () => {
  it("accepts a fresh token for its own event", () => {
    expect(evaluateToken(base, { purpose: "checkin", eventId: "evt-A", now })).toBe("valid");
  });
  it("flags duplicates once max uses is reached", () => {
    expect(evaluateToken({ ...base, useCount: 1 }, { purpose: "checkin", eventId: "evt-A", now })).toBe("duplicate");
  });
  it("flags revoked (token or invitation) and expired", () => {
    expect(evaluateToken({ ...base, revokedAt: now }, { purpose: "checkin", eventId: "evt-A", now })).toBe("revoked");
    expect(evaluateToken({ ...base, invitationStatus: "revoked" }, { purpose: "checkin", eventId: "evt-A", now })).toBe("revoked");
    expect(evaluateToken({ ...base, expiresAt: new Date("2027-06-01T00:00:00Z") }, { purpose: "checkin", eventId: "evt-A", now })).toBe("expired");
    expect(evaluateToken({ ...base, invitationStatus: "expired" }, { purpose: "checkin", eventId: "evt-A", now })).toBe("expired");
  });
  it("is invalid for another event, another purpose or a missing row (no information leak)", () => {
    expect(evaluateToken(base, { purpose: "checkin", eventId: "evt-B", now })).toBe("invalid");
    expect(evaluateToken({ ...base, revokedAt: now }, { purpose: "checkin", eventId: "evt-B", now })).toBe("invalid");
    expect(evaluateToken(base, { purpose: "rsvp", eventId: "evt-A", now })).toBe("invalid");
    expect(evaluateToken(null, { purpose: "checkin", eventId: "evt-A", now })).toBe("invalid");
  });
  it("revoked wins over duplicate", () => {
    expect(evaluateToken({ ...base, useCount: 1, revokedAt: now }, { purpose: "checkin", eventId: "evt-A", now })).toBe("revoked");
  });
});

describe("parseCheckinCode", () => {
  const token = "abcDEF123_-abcDEF123_-abcDEF123_-abcDEF1234";
  it("accepts raw tokens and check-in URLs", () => {
    expect(parseCheckinCode(token)).toBe(token);
    expect(parseCheckinCode(` ${token} `)).toBe(token);
    expect(parseCheckinCode(checkinUrl("http://localhost:3200/", token))).toBe(token);
    expect(parseCheckinCode(`https://sousnosailes.fr/c/${token}?x=1`)).toBe(token);
  });
  it("rejects anything else", () => {
    expect(parseCheckinCode("")).toBeNull();
    expect(parseCheckinCode("short")).toBeNull();
    expect(parseCheckinCode("https://example.com/")).toBeNull();
    expect(parseCheckinCode("'; drop table --")).toBeNull();
  });
  it("builds URLs without personal data", () => {
    expect(checkinUrl("http://localhost:3200", token)).toBe(`http://localhost:3200/c/${token}`);
    expect(rsvpUrl("http://localhost:3200", token)).toBe(`http://localhost:3200/invitation/${token}`);
  });
});
