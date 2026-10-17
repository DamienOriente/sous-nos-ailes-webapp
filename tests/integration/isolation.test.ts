import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { db } from "@/db/client";
import { auditLogs, emailOutbox, eventMembers, eventPermissions, events, notifications, professionalCategories, userProfiles, users } from "@/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getEventAccess, requireEventPermission } from "@/modules/authorization";
import { listChannels } from "@/modules/collaboration/application/channel-service";
import { listMessages, postMessage } from "@/modules/collaboration/application/message-service";
import { getBudget } from "@/modules/events/application/budget-service";
import { listDocuments } from "@/modules/events/application/document-service";
import { createEvent, getEventForMember } from "@/modules/events/application/event-service";
import { listMembers, revokeMember, setMemberPermission } from "@/modules/events/application/member-service";
import { listMilestones, updateMilestone, createMilestone } from "@/modules/events/application/milestone-service";
import { getProvider, listProviders } from "@/modules/events/application/provider-service";
import { createTask, listTasks, updateTask } from "@/modules/events/application/task-service";

/**
 * Scenario D — multi-tenant isolation: two events, two providers, each a member
 * of one event only. Every cross-access must surface as NotFound (never a
 * different error that would confirm the resource exists).
 */
const RUN = `iso-${randomUUID().slice(0, 8)}`;
const mk = (key: string): Actor => ({ userId: `${RUN}-${key}`, email: `${RUN}-${key}@sousnosailes.test`, name: `${key[0]!.toUpperCase()}${key.slice(1)} Test`, globalRole: "user", emailVerified: true, isDemo: true });
const ownerA = mk("ownera");
const ownerB = mk("ownerb");
const proA = mk("proa");
const proB = mk("prob");

let eventA = "";
let eventB = "";
let taskB = "";
let channelB = "";
let providerSlotB = "";
let milestoneB = "";

async function addProvider(eventId: string, actor: Actor, categorySlug: string) {
  const [cat] = await db.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, categorySlug));
  const [m] = await db.insert(eventMembers).values({ eventId, userId: actor.userId, role: "provider", status: "active", categoryId: cat?.id ?? null, joinedAt: new Date() }).returning({ id: eventMembers.id });
  return m!.id;
}

beforeAll(async () => {
  for (const a of [ownerA, ownerB, proA, proB]) {
    await db.insert(users).values({ id: a.userId, name: a.name, email: a.email, emailVerified: true, isDemo: true }).onConflictDoNothing();
    await db.insert(userProfiles).values({ userId: a.userId }).onConflictDoNothing();
  }
  eventA = (await createEvent(ownerA, { type: "birthday", name: `${RUN} A`, eventDate: "2027-05-01", dateIsTentative: false, wantedCategorySlugs: ["animation-enfants"], timezone: "Europe/Paris" })).id;
  eventB = (await createEvent(ownerB, { type: "wedding", name: `${RUN} B`, eventDate: "2027-09-04", dateIsTentative: false, wantedCategorySlugs: ["garde-enfants-evenementielle"], timezone: "Europe/Paris" })).id;
  await addProvider(eventA, proA, "animation-enfants");
  await addProvider(eventB, proB, "garde-enfants-evenementielle");
  taskB = (await createTask(ownerB, eventB, { title: "Tâche B équipe", visibility: "team" })).id;
  channelB = (await listChannels(ownerB, eventB)).channels[0]!.id;
  providerSlotB = (await listProviders(ownerB, eventB)).providers[0]!.id;
  milestoneB = (await createMilestone(ownerB, eventB, { title: "Cérémonie B", date: "2027-09-04", startTime: "15:00", categorySlugs: [] })).id;
});

afterAll(async () => {
  const ids = [ownerA, ownerB, proA, proB].map((a) => a.userId);
  await db.delete(events).where(inArray(events.ownerUserId, ids));
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, ids));
  await db.delete(notifications).where(inArray(notifications.userId, ids));
  await db.delete(emailOutbox).where(like(emailOutbox.toEmail, `${RUN}-%`));
  await db.delete(users).where(inArray(users.id, ids));
});

describe("Scenario D — isolation between events", () => {
  it("members see their own event only", async () => {
    expect((await getEventAccess(proA, eventA))?.role).toBe("provider");
    expect(await getEventAccess(proA, eventB)).toBeNull();
    expect(await getEventAccess(proB, eventA)).toBeNull();
    expect(await getEventAccess(ownerA, eventB)).toBeNull();
  });

  it("every read service answers NotFound across events", async () => {
    await expect(getEventForMember(proA, eventB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listTasks(proA, eventB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listMilestones(proA, eventB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listProviders(proA, eventB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getBudget(ownerA, eventB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listDocuments(proA, eventB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listChannels(proA, eventB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listMessages(proA, eventB, channelB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listMembers(ownerA, eventB)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("swapping ids in a call never reaches another event's rows", async () => {
    // Legit member of A, but the resource id belongs to B.
    await expect(updateTask(ownerA, eventA, taskB, { title: "hack" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(listMessages(ownerA, eventA, channelB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(postMessage(ownerA, eventA, channelB, { body: "hack", attachmentFileIds: [] })).rejects.toBeInstanceOf(NotFoundError);
    await expect(getProvider(ownerA, eventA, providerSlotB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateMilestone(ownerA, eventA, milestoneB, { title: "hack", date: "2027-05-01", startTime: "10:00", categorySlugs: [] })).rejects.toBeInstanceOf(NotFoundError);
    // Nothing changed on B.
    const { tasks } = await listTasks(ownerB, eventB);
    expect(tasks.find((t) => t.id === taskB)?.title).toBe("Tâche B équipe");
  });

  it("an explicit deny beats the role, an expired grant is ignored, a revocation is immediate", async () => {
    const { members } = await listMembers(ownerB, eventB);
    const proBMember = members.find((m) => m.userId === proB.userId)!;
    // Childcare provider sees the roster by trade default…
    expect((await getEventAccess(proB, eventB))?.permissions.has("children.view_roster")).toBe(true);
    // …until the owner explicitly denies it.
    await setMemberPermission(ownerB, eventB, proBMember.id, { permission: "children.view_roster", effect: "deny" });
    expect((await getEventAccess(proB, eventB))?.permissions.has("children.view_roster")).toBe(false);
    await expect(requireEventPermission(proB, eventB, "children.view_roster")).rejects.toBeInstanceOf(ForbiddenError);

    // Expired grant (written directly: the service refuses past dates).
    await db.insert(eventPermissions).values({ eventId: eventB, memberId: proBMember.id, permission: "event.budget.view", effect: "allow", grantedByUserId: ownerB.userId, expiresAt: new Date(Date.now() - 60_000) });
    expect((await getEventAccess(proB, eventB))?.permissions.has("event.budget.view")).toBe(false);
    await expect(getBudget(proB, eventB)).rejects.toBeInstanceOf(ForbiddenError);

    // Revocation: next call is NotFound, not Forbidden.
    await revokeMember(ownerB, eventB, proBMember.id, "test");
    expect(await getEventAccess(proB, eventB)).toBeNull();
    await expect(listTasks(proB, eventB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listMessages(proB, eventB, channelB)).rejects.toBeInstanceOf(NotFoundError);
    const [row] = await db.select().from(eventMembers).where(and(eq(eventMembers.eventId, eventB), eq(eventMembers.userId, proB.userId)));
    expect(row?.status).toBe("revoked");
  });

  it("the other event is untouched by all of the above", async () => {
    expect((await getEventAccess(proA, eventA))?.permissions.has("children.view_roster")).toBe(true);
    const { tasks } = await listTasks(ownerA, eventA);
    expect(tasks.every((t) => t.eventId === eventA)).toBe(true);
  });
});
