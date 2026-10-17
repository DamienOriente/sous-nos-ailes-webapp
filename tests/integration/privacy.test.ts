import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, childSensitiveInformation, consentRecords, contacts, dataSubjectRequests, emailOutbox, eventChildren, events, productEvents, retentionJobs, users } from "@/db/schema";
import { ConflictError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getProductMetrics, lastDaysRange } from "@/modules/analytics/application/metrics";
import { track } from "@/modules/analytics/application/track";
import { hasAnalyticsConsent, recordCookieConsent } from "@/modules/privacy/application/consent-service";
import { exportUserData } from "@/modules/privacy/application/data-export";
import { createDataSubjectRequest, listDataSubjectRequests, updateDataSubjectRequestStatus } from "@/modules/privacy/application/dsr-service";
import { anonymizeChildrenForEndedEventsFallback, runRetentionPolicies } from "@/modules/privacy/application/retention";

const PREFIX = "itest-privacy";
const DAY = 24 * 60 * 60 * 1000;
const anonId = "0f1e2d3c-4b5a-4968-8776-655443322110";

const actor = (id: string, email: string, role: Actor["globalRole"] = "user"): Actor => ({ userId: id, email, name: "Itest", globalRole: role, emailVerified: true, isDemo: false });

const alice = actor(`${PREFIX}-alice`, `${PREFIX}-alice@sousnosailes.test`);
const bob = actor(`${PREFIX}-bob`, `${PREFIX}-bob@sousnosailes.test`);
const staff = actor(`${PREFIX}-admin`, `${PREFIX}-admin@sousnosailes.test`, "admin");
let eventId = "";
let childId = "";

async function cleanup() {
  const ids = [alice.userId, bob.userId, staff.userId];
  await db.delete(productEvents).where(eq(productEvents.anonymousId, anonId));
  await db.delete(consentRecords).where(eq(consentRecords.anonymousId, anonId));
  await db.delete(emailOutbox).where(like(emailOutbox.toEmail, `${PREFIX}%`));
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, ids));
  await db.delete(events).where(inArray(events.ownerUserId, ids));
  await db.delete(users).where(inArray(users.id, ids));
}

beforeAll(async () => {
  await cleanup();
  await db.insert(users).values([
    { id: alice.userId, name: "Alice Itest", email: alice.email, emailVerified: true },
    { id: bob.userId, name: "Bob Itest", email: bob.email, emailVerified: true },
    { id: staff.userId, name: "Staff Itest", email: staff.email, emailVerified: true, role: "admin" },
  ]);
  await db.insert(contacts).values([
    { ownerUserId: alice.userId, firstName: "Contact", lastName: "DAlice", email: `${PREFIX}-c1@sousnosailes.test` },
    { ownerUserId: bob.userId, firstName: "Secret", lastName: "DeBob", email: `${PREFIX}-c2@sousnosailes.test` },
  ]);
  const [ev] = await db
    .insert(events)
    .values({ ownerUserId: alice.userId, name: `${PREFIX} mariage`, type: "wedding", status: "completed", eventDate: "2026-09-01", endsAt: new Date(Date.now() - 40 * DAY), city: "Toulouse" })
    .returning({ id: events.id });
  eventId = ev!.id;
  const [child] = await db
    .insert(eventChildren)
    .values({ eventId, firstName: "Léonie", lastName: "Itest", ageYears: 5, guardianName: "Parent Itest", guardianPhone: "0600000000", careInstructions: "sieste" })
    .returning({ id: eventChildren.id });
  childId = child!.id;
  await db.insert(childSensitiveInformation).values({ childId, allergiesEncrypted: "v1.fake.fake.fake", hasAllergies: true, consentGivenByName: "Parent Itest", consentGivenAt: new Date() });
});

afterAll(async () => {
  await cleanup();
});

describe("data export", () => {
  it("contains only the person's own data: no other user's contacts, no child, no health data", async () => {
    const out = await exportUserData(alice);
    const json = JSON.stringify(out);
    expect(out.account.email).toBe(alice.email);
    expect(out.contacts.map((c) => c.lastName)).toEqual(["DAlice"]);
    expect(out.events.map((e) => e.id)).toEqual([eventId]);
    expect(json).not.toContain("DeBob");
    expect(json).not.toContain("Léonie");
    expect(json).not.toContain("allergies");
    expect(json).not.toContain(bob.email);
    expect(out.excluded.length).toBeGreaterThan(0);
    const [log] = await db.select().from(auditLogs).where(and(eq(auditLogs.actorUserId, alice.userId), eq(auditLogs.action, "privacy.export.generated"))).limit(1);
    expect(log).toBeTruthy();
  });
});

describe("retention", () => {
  it("anonymises children of events ended more than N days ago and deletes their health data", async () => {
    const affected = await anonymizeChildrenForEndedEventsFallback(30, new Date());
    expect(affected).toBeGreaterThanOrEqual(1);
    const [row] = await db.select().from(eventChildren).where(eq(eventChildren.id, childId));
    expect(row?.firstName).toBe("Enfant");
    expect(row?.guardianPhone).toBe("");
    expect(row?.careInstructions).toBeNull();
    expect(row?.anonymizedAt).toBeInstanceOf(Date);
    const sensitive = await db.select().from(childSensitiveInformation).where(eq(childSensitiveInformation.childId, childId));
    expect(sensitive).toHaveLength(0);
    // Idempotent: a second pass finds nothing.
    expect(await anonymizeChildrenForEndedEventsFallback(30, new Date())).toBe(0);
  });

  it("runs every policy and journals each run in retention_jobs", async () => {
    const before = Date.now();
    const results = await runRetentionPolicies();
    const names = results.map((r) => r.policy);
    expect(names).toEqual(["children_anonymisation", "sessions_purge", "verifications_purge", "notifications_purge", "logs_purge", "inactive_accounts"]);
    const jobs = await db.select().from(retentionJobs).orderBy(desc(retentionJobs.createdAt)).limit(6);
    expect(jobs.every((j) => j.status === "succeeded" && j.createdAt.getTime() >= before - 1000)).toBe(true);
  });
});

describe("data subject requests", () => {
  it("creates a request due in 30 days, refuses duplicates and audits status changes", async () => {
    const created = await createDataSubjectRequest(alice, { kind: "rectification", details: "Mon prénom est mal orthographié." });
    const diff = created.dueAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan(29 * DAY);
    expect(diff).toBeLessThanOrEqual(30 * DAY);
    await expect(createDataSubjectRequest(alice, { kind: "rectification" })).rejects.toBeInstanceOf(ConflictError);
    await expect(createDataSubjectRequest(alice, { kind: "access" })).rejects.toThrow();

    const open = await listDataSubjectRequests(staff, { status: "open" });
    expect(open.some((r) => r.id === created.id && r.userName === "Alice Itest")).toBe(true);
    await expect(listDataSubjectRequests(bob)).rejects.toThrow();

    await expect(updateDataSubjectRequestStatus(staff, created.id, "completed", "")).rejects.toThrow();
    await updateDataSubjectRequestStatus(staff, created.id, "completed", "Prénom corrigé.");
    const [row] = await db.select().from(dataSubjectRequests).where(eq(dataSubjectRequests.id, created.id));
    expect(row?.status).toBe("completed");
    expect(row?.completedAt).toBeInstanceOf(Date);
    expect(row?.handledByUserId).toBe(staff.userId);
    const [audit] = await db.select().from(auditLogs).where(and(eq(auditLogs.resourceId, created.id), eq(auditLogs.action, "privacy.dsr.status_changed")));
    expect(audit?.reason).toBe("Prénom corrigé.");
    await expect(updateDataSubjectRequestStatus(staff, created.id, "received", "x")).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("consent and analytics", () => {
  it("stores one proof per category and gates anonymous tracking on consent", async () => {
    await recordCookieConsent({ anonymousId: anonId, choices: { analytics: false, marketing: false }, ipAddress: "82.65.12.201", userAgent: "vitest" });
    expect(await hasAnalyticsConsent(anonId)).toBe(false);
    expect(await track("directory.searched", { categorySlug: "dj", hasCity: true }, { anonymousId: anonId, analyticsConsent: false })).toBe(false);

    await recordCookieConsent({ anonymousId: anonId, choices: { analytics: true, marketing: false }, previous: { analytics: false, marketing: false } });
    expect(await hasAnalyticsConsent(anonId)).toBe(true);
    expect(await track("directory.searched", { categorySlug: "dj", hasCity: true, query: "free text" }, { anonymousId: anonId, analyticsConsent: true })).toBe(true);

    const rows = await db.select().from(consentRecords).where(eq(consentRecords.anonymousId, anonId));
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.ipAddress === null || r.ipAddress.endsWith(".0"))).toBe(true);
    const [ev] = await db.select().from(productEvents).where(eq(productEvents.anonymousId, anonId));
    expect(ev?.properties).toEqual({ categorySlug: "dj", hasCity: true });

    const metrics = await getProductMetrics(lastDaysRange(1));
    expect(metrics.counts["directory.searched"]).toBeGreaterThanOrEqual(1);
  });
});
