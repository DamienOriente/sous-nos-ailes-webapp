import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { calendarConnections, calendarEntries, calendarReminderDispatches, calendarSyncJobs, calendarSyncMappings, notifications } from "@/db/schema";
import { encryptText } from "@/lib/crypto";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { createEntry, deleteEntry, listOccurrences, updateEntry } from "@/modules/calendar/application/calendar-service";
import { exportUserCalendarIcs } from "@/modules/calendar/application/ics-export";
import { importIcs, parseIcsText, previewIcsImport } from "@/modules/calendar/application/ics-import";
import { dispatchDueReminders } from "@/modules/calendar/application/reminders";
import { runCalendarSyncJob } from "@/modules/calendar/application/sync-engine";
import { GoogleCalendarAdapter } from "@/modules/calendar/infrastructure/google-calendar";
import { cleanupUsers, createUser } from "./_fixtures";

/** Scenario F: create, edit, conflict, ICS export/import, mocked Google sync with failure + retry. */
let theo: Actor;
let other: Actor;

beforeAll(async () => {
  [theo, other] = await Promise.all([createUser("theo"), createUser("other")]);
});
afterAll(async () => {
  await cleanupUsers([theo, other]);
});

const base = { description: null, location: null, allDay: false, timezone: "Europe/Paris", rrule: null, reminderMinutesBefore: null, professionalId: null, eventId: null };

describe("entries", () => {
  it("creates, edits, detects conflicts and isolates owners", async () => {
    const a = await createEntry(theo, { ...base, title: "DJ mariage", kind: "service", startsAt: new Date("2027-06-12T14:00:00Z"), endsAt: new Date("2027-06-13T02:00:00Z") });
    const b = await createEntry(theo, { ...base, title: "Anniversaire", kind: "service", startsAt: new Date("2027-06-12T18:00:00Z"), endsAt: new Date("2027-06-13T00:00:00Z") });
    await createEntry(theo, { ...base, title: "Dispo", kind: "availability", startsAt: new Date("2027-06-12T08:00:00Z"), endsAt: new Date("2027-06-12T20:00:00Z") });
    const weekly = await createEntry(theo, { ...base, title: "Fermé le lundi", kind: "unavailability", allDay: true, startsAt: new Date("2027-01-03T23:00:00Z"), endsAt: new Date("2027-01-04T23:00:00Z"), rrule: "FREQ=WEEKLY;BYDAY=MO" });

    const june = await listOccurrences(theo, new Date("2027-06-01T00:00:00Z"), new Date("2027-07-01T00:00:00Z"));
    expect(june.conflicts).toHaveLength(1);
    expect(june.occurrences.filter((o) => o.conflict).map((o) => o.entryId).sort()).toEqual([a.id, b.id].sort());
    expect(june.occurrences.filter((o) => o.entryId === weekly.id)).toHaveLength(4); // Mondays in June 2027: 7, 14, 21, 28
    expect(june.occurrences.filter((o) => o.kind === "availability")[0]!.conflict).toBe(false);

    await updateEntry(theo, b.id, { ...base, title: "Anniversaire (déplacé)", kind: "service", startsAt: new Date("2027-06-19T18:00:00Z"), endsAt: new Date("2027-06-20T00:00:00Z") });
    const after = await listOccurrences(theo, new Date("2027-06-01T00:00:00Z"), new Date("2027-07-01T00:00:00Z"));
    expect(after.conflicts).toHaveLength(0);

    // Other users see nothing and cannot touch Théo's entries.
    const otherView = await listOccurrences(other, new Date("2027-06-01T00:00:00Z"), new Date("2027-07-01T00:00:00Z"));
    expect(otherView.occurrences).toHaveLength(0);
    await expect(updateEntry(other, a.id, { ...base, title: "hack", kind: "other", startsAt: new Date(), endsAt: new Date(Date.now() + 1000) })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteEntry(other, a.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createEntry(theo, { ...base, title: "bad", kind: "other", startsAt: new Date("2027-06-12T14:00:00Z"), endsAt: new Date("2027-06-12T14:00:00Z"), rrule: "FREQ=YEARLY" })).rejects.toThrow();
  });

  it("exports ICS and re-imports it idempotently; invalid files are rejected", async () => {
    const ics = await exportUserCalendarIcs(theo);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:DJ mariage");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    const parsed = parseIcsText(ics);
    expect(parsed.errors).toEqual([]);
    expect(parsed.events.length).toBeGreaterThanOrEqual(4);

    // Re-import into the same account: all UIDs exist → updates, no duplicates.
    const preview = await previewIcsImport(theo, ics);
    expect(preview.toCreate).toHaveLength(0);
    expect(preview.toUpdate.length).toBe(parsed.events.length);
    const before = await db.select({ id: calendarEntries.id }).from(calendarEntries).where(eq(calendarEntries.ownerUserId, theo.userId));
    const res = await importIcs(theo, ics);
    const after = await db.select({ id: calendarEntries.id }).from(calendarEntries).where(eq(calendarEntries.ownerUserId, theo.userId));
    expect(after.length).toBe(before.length);
    expect(res.updated + res.created).toBe(parsed.events.length);

    // Import into another account → created.
    const other1 = await importIcs(other, ics);
    expect(other1.created).toBe(parsed.events.length);

    await expect(importIcs(theo, "hello")).rejects.toBeInstanceOf(ValidationError);
    await expect(importIcs(theo, "x".repeat(1_048_577))).rejects.toBeInstanceOf(ValidationError);
    const noEvents = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:x\r\nEND:VCALENDAR\r\n";
    await expect(importIcs(theo, noEvents)).rejects.toBeInstanceOf(ValidationError);
    const badDates = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:x", "BEGIN:VEVENT", "UID:bad", "DTSTAMP:20260101T000000Z", "DTSTART:20270102T100000Z", "DTEND:20270101T110000Z", "SUMMARY:Inversé", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const badPreview = await previewIcsImport(theo, badDates);
    expect(badPreview.toCreate).toHaveLength(0);
    expect(badPreview.skipped[0]?.reason).toMatch(/précède/);
  });
});

describe("reminders", () => {
  it("dispatches one deadline notification per due occurrence and never twice", async () => {
    const now = new Date();
    const entry = await createEntry(theo, { ...base, title: "Rappel test", kind: "service", startsAt: new Date(now.getTime() + 30 * 60_000), endsAt: new Date(now.getTime() + 90 * 60_000), reminderMinutesBefore: 60 });
    const first = await dispatchDueReminders(db, now);
    expect(first).toBeGreaterThanOrEqual(1);
    const second = await dispatchDueReminders(db, now);
    const dispatches = await db.select().from(calendarReminderDispatches).where(eq(calendarReminderDispatches.entryId, entry.id));
    expect(dispatches).toHaveLength(1);
    expect(second).toBe(0);
    const notifs = await db.select().from(notifications).where(and(eq(notifications.userId, theo.userId), eq(notifications.type, "deadline")));
    expect(notifs.some((n) => n.title === "Rappel : Rappel test")).toBe(true);
    await deleteEntry(theo, entry.id);
  });
});

describe("Google sync with a mocked provider (contract only — no real API)", () => {
  // In-memory fake of the Google Calendar events collection.
  const remote = new Map<string, Record<string, unknown>>();
  let failNext = false;
  let counter = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (failNext) {
      failNext = false;
      return new Response(JSON.stringify({ error: "boom" }), { status: 500 });
    }
    const u = new URL(url);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (u.pathname.endsWith("/token")) return json({ access_token: "fresh", expires_in: 3600 });
    const m = /\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(u.pathname);
    if (!m) return json({ error: "not mocked" }, 404);
    const id = m[2] ? decodeURIComponent(m[2]) : null;
    if (init.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      const newId = `g${++counter}`;
      remote.set(newId, { ...body, id: newId, etag: `"${counter}"` });
      return json(remote.get(newId));
    }
    if (init.method === "PATCH" && id) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      remote.set(id, { ...remote.get(id), ...body, id, etag: `"${++counter}"` });
      return json(remote.get(id));
    }
    if (init.method === "DELETE" && id) {
      remote.delete(id);
      return new Response(null, { status: 204 });
    }
    // list
    return json({ items: [...remote.values()], nextSyncToken: `tok-${counter}` });
  });
  const adapter = new GoogleCalendarAdapter({ clientId: "x", clientSecret: "y" }, fetchMock as unknown as typeof fetch);
  let connectionId: string;

  it("fails cleanly (job failed, connection error) then succeeds on retry", async () => {
    // Fresh user so other tests' entries do not interfere.
    const user = await createUser("sync");
    const [c] = await db
      .insert(calendarConnections)
      .values({ userId: user.userId, provider: "google", externalCalendarId: "primary", accessTokenEncrypted: encryptText("expired"), refreshTokenEncrypted: encryptText("refresh"), accessTokenExpiresAt: new Date(Date.now() - 1000), syncDirection: "both", status: "active" })
      .returning({ id: calendarConnections.id });
    connectionId = c!.id;
    const internal = await createEntry(user, { ...base, title: "Interne", kind: "service", startsAt: new Date("2027-07-01T10:00:00Z"), endsAt: new Date("2027-07-01T12:00:00Z") });
    remote.set("ext1", { id: "ext1", etag: '"e1"', iCalUID: "ext1@google.com", summary: "Externe", start: { dateTime: "2027-07-02T10:00:00Z", timeZone: "Europe/Paris" }, end: { dateTime: "2027-07-02T11:00:00Z" } });

    failNext = true; // token refresh fails → job failed
    await expect(runCalendarSyncJob(connectionId, adapter)).rejects.toThrow();
    const [failed] = await db.select().from(calendarSyncJobs).where(eq(calendarSyncJobs.connectionId, connectionId));
    expect(failed!.status).toBe("failed");
    expect(failed!.error).toMatch(/500/);
    const [conn1] = await db.select().from(calendarConnections).where(eq(calendarConnections.id, connectionId));
    expect(conn1!.status).toBe("error");

    const res = await runCalendarSyncJob(connectionId, adapter);
    expect(res).toEqual({ pushed: 1, pulled: 1, conflicts: 0 });
    const [conn2] = await db.select().from(calendarConnections).where(eq(calendarConnections.id, connectionId));
    expect(conn2!.status).toBe("active");
    expect(conn2!.syncCursor).toMatch(/^tok-/);
    expect(conn2!.accessTokenEncrypted).not.toBe(encryptText("expired")); // refreshed + re-encrypted
    const mappings = await db.select().from(calendarSyncMappings).where(eq(calendarSyncMappings.connectionId, connectionId));
    expect(mappings).toHaveLength(2);
    const pulled = await db.select().from(calendarEntries).where(and(eq(calendarEntries.ownerUserId, user.userId), eq(calendarEntries.icalUid, "ext1@google.com")));
    expect(pulled).toHaveLength(1);
    expect(pulled[0]!.sourceConnectionId).toBe(connectionId);
    expect([...remote.values()].some((r) => r.summary === "Interne")).toBe(true);

    // Second run without changes: nothing pushed/pulled.
    expect(await runCalendarSyncJob(connectionId, adapter)).toEqual({ pushed: 0, pulled: 0, conflicts: 0 });

    // Both sides edited → conflict, internal kept and re-pushed.
    await updateEntry(user, internal.id, { ...base, title: "Interne v2", kind: "service", startsAt: new Date("2027-07-01T10:00:00Z"), endsAt: new Date("2027-07-01T12:00:00Z") });
    const internalMapping = mappings.find((m) => m.entryId === internal.id)!;
    remote.set(internalMapping.externalId, { ...remote.get(internalMapping.externalId), summary: "Interne modifié côté Google", etag: '"zz"' });
    const conflict = await runCalendarSyncJob(connectionId, adapter);
    expect(conflict.conflicts).toBe(1);
    expect(conflict.pushed).toBe(1);
    expect(remote.get(internalMapping.externalId)?.summary).toBe("Interne v2");
    const [job] = await db.select().from(calendarSyncJobs).where(and(eq(calendarSyncJobs.connectionId, connectionId), eq(calendarSyncJobs.conflicts, 1)));
    expect(job!.status).toBe("succeeded");

    // External edit only → pulled; external deletion → internal (origin external) removed.
    remote.set("ext1", { ...remote.get("ext1"), summary: "Externe v2", etag: '"e2"' });
    const pull = await runCalendarSyncJob(connectionId, adapter);
    expect(pull.pulled).toBe(1);
    const [ext] = await db.select().from(calendarEntries).where(and(eq(calendarEntries.ownerUserId, user.userId), eq(calendarEntries.icalUid, "ext1@google.com")));
    expect(ext!.title).toBe("Externe v2");
    remote.set("ext1", { id: "ext1", status: "cancelled" });
    await runCalendarSyncJob(connectionId, adapter);
    expect(await db.select().from(calendarEntries).where(and(eq(calendarEntries.ownerUserId, user.userId), eq(calendarEntries.icalUid, "ext1@google.com")))).toHaveLength(0);

    // Internal deletion → external delete.
    await deleteEntry(user, internal.id);
    await runCalendarSyncJob(connectionId, adapter);
    expect(remote.has(internalMapping.externalId)).toBe(false);

    await cleanupUsers([user]);
  });
});
