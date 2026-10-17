import { describe, expect, it } from "vitest";
import { normalizeTypeOverrides, notificationPreferencesSchema } from "@/modules/identity/domain/notification-preferences";
import { fullName, profileSchema, splitName, TIMEZONES } from "@/modules/identity/domain/profile";
import { describeUserAgent, isPrivilegedRole, toSessionViews } from "@/modules/identity/domain/security";

describe("profileSchema", () => {
  const valid = { firstName: " Ana ", lastName: "Dupont", phone: "06 12 34 56 78", city: "Toulouse", postalCode: "31000", timezone: "Europe/Paris", locale: "fr" };
  it("trims and accepts a complete profile", () => {
    const r = profileSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.firstName).toBe("Ana");
  });
  it("turns empty optional fields into null", () => {
    const r = profileSchema.safeParse({ ...valid, phone: "", city: "  ", postalCode: "" });
    expect(r.success).toBe(true);
    if (r.success) expect([r.data.phone, r.data.city, r.data.postalCode]).toEqual([null, null, null]);
  });
  it("rejects unknown timezones, bad phones and bad locales", () => {
    expect(profileSchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, phone: "call me" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, locale: "de" }).success).toBe(false);
  });
  it("offers Europe/Paris first and only IANA-looking zones", () => {
    expect(TIMEZONES[0]).toBe("Europe/Paris");
    for (const tz of TIMEZONES) expect(() => new Intl.DateTimeFormat("fr-FR", { timeZone: tz })).not.toThrow();
  });
});

describe("names", () => {
  it("round-trips first/last name", () => {
    expect(fullName(" Ana", "Dupont ")).toBe("Ana Dupont");
    expect(splitName("Marie Delcourt")).toEqual({ firstName: "Marie", lastName: "Delcourt" });
    expect(splitName("Jean Pierre de La Tour")).toEqual({ firstName: "Jean", lastName: "Pierre de La Tour" });
    expect(splitName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
  });
});

describe("notification preferences", () => {
  it("only stores disabled types", () => {
    expect(normalizeTypeOverrides({ new_message: true, deadline: false, payment_alert: false })).toEqual({ deadline: false, payment_alert: false });
  });
  it("validates digest values and unknown type keys", () => {
    expect(notificationPreferencesSchema.safeParse({ emailEnabled: true, emailDigest: "weekly", types: {}, marketingEmails: false }).success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({ emailEnabled: true, emailDigest: "daily", types: { nope: false }, marketingEmails: false }).success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({ emailEnabled: false, emailDigest: "off", types: { deadline: false }, marketingEmails: true }).success).toBe(true);
  });
});

describe("security helpers", () => {
  it("flags privileged roles", () => {
    expect(isPrivilegedRole("user")).toBe(false);
    expect(isPrivilegedRole("moderator")).toBe(true);
    expect(isPrivilegedRole("super_admin")).toBe(true);
  });
  it("describes user agents coarsely", () => {
    expect(describeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe("Chrome · macOS");
    expect(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari · iOS");
    expect(describeUserAgent(null)).toBe("Appareil inconnu");
  });
});

describe("toSessionViews", () => {
  it("drops expired sessions, strips tokens, puts the current session first", () => {
    const now = Date.UTC(2026, 9, 17, 12);
    const d = (offsetMin: number) => new Date(now + offsetMin * 60_000);
    const raw = [
      { id: "old", token: "t-old", createdAt: d(-500), updatedAt: d(-400), expiresAt: d(-1), userAgent: "x" },
      { id: "other", token: "t-other", createdAt: d(-100), updatedAt: d(-5), expiresAt: d(1000), ipAddress: "10.0.0.2" },
      { id: "me", token: "t-me", createdAt: d(-50), updatedAt: d(-30), expiresAt: d(1000) },
    ];
    const views = toSessionViews(raw, "me", now);
    expect(views.map((v) => v.id)).toEqual(["me", "other"]);
    expect(views[0]?.isCurrent).toBe(true);
    expect(views.some((v) => "token" in v)).toBe(false);
    expect(views[1]?.ipAddress).toBe("10.0.0.2");
  });
});
