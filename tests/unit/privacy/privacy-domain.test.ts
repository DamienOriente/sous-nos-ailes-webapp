import { describe, expect, it } from "vitest";
import { ALL_ACCEPTED, ALL_REFUSED, CONSENT_CATEGORIES, CONSENT_MAX_AGE_SECONDS, CONSENT_POLICY_VERSION, isConsentCurrent, parseConsent, serializeConsent, truncateIp } from "@/modules/privacy/domain/consent";
import { computeDueAt, daysUntil, dueTone, DSR_RESPONSE_DAYS, SELF_SERVICE_KINDS } from "@/modules/privacy/domain/dsr";
import { PROCESSING_REGISTRY } from "@/modules/privacy/domain/processing-registry";

describe("cookie consent", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";

  it("round-trips through the cookie value and stays small", () => {
    const state = { anonymousId: id, version: CONSENT_POLICY_VERSION, choices: { analytics: true, marketing: false }, decidedAt: new Date().toISOString() };
    const raw = serializeConsent(state);
    expect(raw.length).toBeLessThan(160);
    expect(parseConsent(raw)).toEqual(state);
  });

  it("rejects malformed or forged cookie values", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("not json")).toBeNull();
    expect(parseConsent(JSON.stringify({ id: "x", v: "1", t: "now" }))).toBeNull();
    expect(parseConsent(JSON.stringify({ id, v: 1, t: "now" }))).toBeNull();
  });

  it("expires after the retention window or a policy change", () => {
    const now = new Date("2026-10-17T00:00:00Z");
    const fresh = { anonymousId: id, version: CONSENT_POLICY_VERSION, choices: ALL_REFUSED, decidedAt: "2026-10-01T00:00:00Z" };
    expect(isConsentCurrent(fresh, now)).toBe(true);
    const old = { ...fresh, decidedAt: new Date(now.getTime() - (CONSENT_MAX_AGE_SECONDS + 1) * 1000).toISOString() };
    expect(isConsentCurrent(old, now)).toBe(false);
    expect(isConsentCurrent({ ...fresh, version: "2020-01" }, now)).toBe(false);
    expect(isConsentCurrent(null, now)).toBe(false);
  });

  it("has exactly one required category and nothing pre-accepted by default", () => {
    expect(CONSENT_CATEGORIES.filter((c) => c.required).map((c) => c.key)).toEqual(["essential"]);
    expect(ALL_REFUSED).toEqual({ analytics: false, marketing: false });
    expect(ALL_ACCEPTED).toEqual({ analytics: true, marketing: true });
  });

  it("truncates IP addresses before storing a proof", () => {
    expect(truncateIp("82.65.12.201")).toBe("82.65.12.0");
    expect(truncateIp("2a01:cb00:1234:5678:abcd:ef01:2345:6789")).toBe("2a01:cb00:1234:5678:0:0:0:0");
    expect(truncateIp("garbage")).toBeNull();
    expect(truncateIp(null)).toBeNull();
  });
});

describe("data subject requests", () => {
  it("computes the legal one-month due date", () => {
    const received = new Date("2026-10-17T10:00:00Z");
    expect(DSR_RESPONSE_DAYS).toBe(30);
    expect(computeDueAt(received).toISOString()).toBe("2026-11-16T10:00:00.000Z");
  });

  it("flags overdue and soon-due requests", () => {
    const now = new Date("2026-10-17T00:00:00Z");
    expect(daysUntil(new Date("2026-10-20T00:00:00Z"), now)).toBe(3);
    expect(dueTone(new Date("2026-10-20T00:00:00Z"), "received", now)).toBe("warning");
    expect(dueTone(new Date("2026-10-10T00:00:00Z"), "in_progress", now)).toBe("danger");
    expect(dueTone(new Date("2026-12-10T00:00:00Z"), "received", now)).toBe("neutral");
    expect(dueTone(new Date("2026-10-10T00:00:00Z"), "completed", now)).toBe("success");
  });

  it("does not expose 'access' as a self-service request (served by the instant export)", () => {
    expect(SELF_SERVICE_KINDS).not.toContain("access");
    expect(SELF_SERVICE_KINDS).toContain("erasure");
  });
});

describe("processing register", () => {
  it("covers every sensitive table and never claims a decision the owner has not taken", () => {
    const tables = new Set(PROCESSING_REGISTRY.flatMap((a) => a.tables));
    for (const t of ["child_sensitive_information", "child_access_logs", "consent_records", "data_subject_requests", "product_events", "audit_logs"]) expect(tables.has(t)).toBe(true);
    const children = PROCESSING_REGISTRY.find((a) => a.key === "children");
    expect(children?.sensitive).toBe(true);
    // Processor names are placeholders until contracts exist.
    expect(PROCESSING_REGISTRY.some((a) => a.legalBasis.includes("À COMPLÉTER") || a.retention.includes("À COMPLÉTER"))).toBe(true);
  });
});
