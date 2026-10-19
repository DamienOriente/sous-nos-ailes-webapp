import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { db } from "@/db/client";
import { consentRecords, eventMembers, events, notificationPreferences, notifications, professionalCategories, professionals, securityEvents, userProfiles, users } from "@/db/schema";
import { RateLimitedError } from "@/lib/errors";
import { redis } from "@/lib/redis";
import type { Actor } from "@/lib/session";
import { getHomeDashboard } from "@/modules/identity/application/home-dashboard";
import { getNotificationPreferences, getProfile, recordSignupConsents, setPrimaryIntent, updateNotificationPreferences, updateProfile } from "@/modules/identity/application/profile-service";
import { assertRateLimit, isTwoFactorEnabled, listMySecurityEvents, recordSecurityEvent } from "@/modules/identity/application/security-service";

const RUN = Date.now().toString(36);
const ids = { alice: `itest-identity-alice-${RUN}`, bob: `itest-identity-bob-${RUN}` };
const alice: Actor = { userId: ids.alice, email: `itest-alice-${RUN}@sousnosailes.test`, name: "Alice Itest", globalRole: "user", emailVerified: false, isDemo: true };
const bob: Actor = { userId: ids.bob, email: `itest-bob-${RUN}@sousnosailes.test`, name: "Bob Itest", globalRole: "moderator", emailVerified: true, isDemo: true };

beforeAll(async () => {
  for (const a of [alice, bob]) {
    await db.insert(users).values({ id: a.userId, name: a.name, email: a.email, emailVerified: a.emailVerified, role: a.globalRole, isDemo: true });
  }
});

afterAll(async () => {
  // users cascade to profiles, sessions, notifications, consents, events members; events/professionals restrict → delete first
  await db.delete(events).where(eq(events.ownerUserId, ids.alice));
  await db.delete(events).where(eq(events.ownerUserId, ids.bob));
  await db.delete(professionals).where(eq(professionals.ownerUserId, ids.alice));
  for (const id of Object.values(ids)) await db.delete(users).where(eq(users.id, id));
  await redis.del(`rl:identity:itest:${RUN}`);
});

describe("profile", () => {
  it("heals a missing profile row and splits the legacy name", async () => {
    const p = await getProfile(alice);
    expect(p).toMatchObject({ firstName: "Alice", lastName: "Itest", email: alice.email, timezone: "Europe/Paris", primaryIntent: null });
  });
  it("updates profile + users.name/timezone/locale atomically", async () => {
    await updateProfile(alice, { firstName: "Alicia", lastName: "Itest-Martin", phone: "0612345678", city: "Toulouse", postalCode: "31000", timezone: "Europe/Brussels", locale: "en" });
    const p = await getProfile(alice);
    expect(p).toMatchObject({ firstName: "Alicia", lastName: "Itest-Martin", phone: "0612345678", city: "Toulouse", timezone: "Europe/Brussels", locale: "en" });
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, ids.alice));
    expect(u?.name).toBe("Alicia Itest-Martin");
  });
  it("stores the onboarding intent without restricting anything else", async () => {
    await setPrimaryIntent(alice, "professional");
    expect((await getProfile(alice)).primaryIntent).toBe("professional");
    await setPrimaryIntent(alice, "organizer");
    expect((await getProfile(alice)).primaryIntent).toBe("organizer");
  });
  it("records terms + privacy consents with the policy version", async () => {
    await recordSignupConsents(ids.alice, { ipAddress: "127.0.0.1", userAgent: "vitest" });
    const rows = await db.select().from(consentRecords).where(eq(consentRecords.userId, ids.alice));
    expect(rows.map((r) => r.purpose).sort()).toEqual(["privacy_policy", "terms"]);
    expect(rows.every((r) => r.granted === "granted" && r.policyVersion === "2026-10")).toBe(true);
  });
});

describe("notification preferences", () => {
  it("defaults when no row exists", async () => {
    expect(await getNotificationPreferences(alice)).toEqual({ emailEnabled: true, emailDigest: "immediate", types: {}, marketingEmails: false });
  });
  it("persists overrides minimally and journals the marketing consent change only", async () => {
    await updateNotificationPreferences(alice, { emailEnabled: true, emailDigest: "daily", types: { deadline: false, new_message: true }, marketingEmails: true }, { ipAddress: "127.0.0.1" });
    const [row] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, ids.alice));
    expect(row?.types).toEqual({ deadline: false });
    expect(row?.emailDigest).toBe("daily");
    let consents = await db.select().from(consentRecords).where(eq(consentRecords.userId, ids.alice));
    expect(consents.filter((c) => c.purpose === "marketing_emails")).toHaveLength(1);
    expect(consents.find((c) => c.purpose === "marketing_emails")?.granted).toBe("granted");

    // Same marketing value → no new consent row; withdrawing → "withdrawn" row
    await updateNotificationPreferences(alice, { emailEnabled: false, emailDigest: "off", types: {}, marketingEmails: true }, {});
    consents = await db.select().from(consentRecords).where(eq(consentRecords.userId, ids.alice));
    expect(consents.filter((c) => c.purpose === "marketing_emails")).toHaveLength(1);
    await updateNotificationPreferences(alice, { emailEnabled: false, emailDigest: "off", types: {}, marketingEmails: false }, {});
    consents = await db.select().from(consentRecords).where(eq(consentRecords.userId, ids.alice));
    const marketing = consents.filter((c) => c.purpose === "marketing_emails").map((c) => c.granted).sort();
    expect(marketing).toEqual(["granted", "withdrawn"]);
    const [profile] = await db.select({ opt: userProfiles.marketingOptIn }).from(userProfiles).where(eq(userProfiles.userId, ids.alice));
    expect(profile?.opt).toBe(false);
  });
});

describe("security", () => {
  it("records events, tolerates junk IPs, and lists only the actor's own", async () => {
    await recordSecurityEvent({ type: "login_failed", ipAddress: "not-an-ip, 10.0.0.1", userAgent: "vitest", details: { emailDomain: "sousnosailes.test" } });
    await recordSecurityEvent({ type: "password_changed", userId: ids.alice, ipAddress: "10.0.0.1", userAgent: "vitest" });
    await recordSecurityEvent({ type: "two_factor_enabled", userId: ids.bob, ipAddress: "::1" });
    const mine = await listMySecurityEvents(alice);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ type: "password_changed", severity: "medium", ipAddress: "10.0.0.1" });
    const anonymous = await db.select().from(securityEvents).where(eq(securityEvents.type, "login_failed"));
    expect(anonymous.some((e) => e.ipAddress === null && e.userAgent === "vitest")).toBe(true);
  });
  it("reads the 2FA flag", async () => {
    expect(await isTwoFactorEnabled(ids.bob)).toBe(false);
    await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, ids.bob));
    expect(await isTwoFactorEnabled(ids.bob)).toBe(true);
  });
  it("rate limits with a fixed window in Redis", async () => {
    const key = `itest:${RUN}`;
    for (let i = 0; i < 3; i++) await assertRateLimit(key, 3, 60);
    await expect(assertRateLimit(key, 3, 60)).rejects.toBeInstanceOf(RateLimitedError);
  });
});

describe("home dashboard", () => {
  it("only shows events where the actor is an active member, own listings, and unread notifications", async () => {
    const [cat] = await db.select({ id: professionalCategories.id }).from(professionalCategories).limit(1);
    if (!cat) throw new Error("seed categories required");
    const inserted = await db
      .insert(events)
      .values([
        { ownerUserId: ids.bob, name: `itest-ev-shared-${RUN}`, type: "wedding", eventDate: "2030-06-12", isDemo: true },
        { ownerUserId: ids.bob, name: `itest-ev-revoked-${RUN}`, type: "baptism", eventDate: "2030-07-01", isDemo: true },
        { ownerUserId: ids.bob, name: `itest-ev-private-${RUN}`, type: "seminar", eventDate: "2030-08-01", isDemo: true },
        { ownerUserId: ids.bob, name: `itest-ev-past-${RUN}`, type: "birthday", eventDate: "2001-01-01", isDemo: true },
      ])
      .returning({ id: events.id, name: events.name });
    const byName = (n: string) => inserted.find((e) => e.name.includes(n))!.id;
    await db.insert(eventMembers).values([
      { eventId: byName("shared"), userId: ids.alice, role: "co_organizer", status: "active" },
      { eventId: byName("revoked"), userId: ids.alice, role: "provider", status: "revoked" },
      { eventId: byName("past"), userId: ids.alice, role: "guest", status: "active" },
      ...inserted.map((e) => ({ eventId: e.id, userId: ids.bob, role: "owner" as const, status: "active" as const })),
    ]);
    await db.insert(professionals).values({ ownerUserId: ids.alice, slug: `itest-pro-${RUN}`, displayName: "Itest Pro", primaryCategoryId: cat.id, isDemo: true });
    await db.insert(notifications).values([
      { userId: ids.alice, type: "system", title: "unread one" },
      { userId: ids.alice, type: "system", title: "already read", readAt: new Date() },
      { userId: ids.bob, type: "system", title: "bob's" },
    ]);

    const dash = await getHomeDashboard(alice);
    expect(dash.upcomingEvents.map((e) => e.name)).toEqual([`itest-ev-shared-${RUN}`]);
    expect(dash.upcomingEvents[0]?.role).toBe("co_organizer");
    expect(dash.professionals.map((p) => p.displayName)).toEqual(["Itest Pro"]);
    expect(dash.unreadNotifications.map((n) => n.title)).toEqual(["unread one"]);
    expect(dash.unreadCount).toBe(1);
    expect(dash.isEmpty).toBe(false);
    expect(dash.twoFactorRequiredButMissing).toBe(false);

    const bobDash = await getHomeDashboard(bob);
    expect(bobDash.upcomingEvents).toHaveLength(3);
    expect(bobDash.professionals).toHaveLength(0);
    // bob is a moderator with 2FA enabled (set above) → no alert
    expect(bobDash.twoFactorRequiredButMissing).toBe(false);
    await db.update(users).set({ twoFactorEnabled: false }).where(eq(users.id, ids.bob));
    expect((await getHomeDashboard(bob)).twoFactorRequiredButMissing).toBe(true);
  });
});
