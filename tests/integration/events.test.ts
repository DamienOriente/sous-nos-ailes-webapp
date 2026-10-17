import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { db } from "@/db/client";
import { auditLogs, calendarEntries, channelMembers, checklistTemplates, emailOutbox, eventBudgetLines, eventChannels, eventMembers, eventProfessionals, eventTasks, events, invitationTokens, invitations, notifications, professionalCategories, userProfiles, users } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getEventAccess } from "@/modules/authorization";
import { createChannel, listChannels, markChannelRead } from "@/modules/collaboration/application/channel-service";
import { listMessages, postMessage } from "@/modules/collaboration/application/message-service";
import { createBudgetLine, createExpense, getBudget } from "@/modules/events/application/budget-service";
import { getEventDashboard } from "@/modules/events/application/dashboard-service";
import { changeEventStatus, createEvent, deleteEvent, getEventForMember, listEventsForActor } from "@/modules/events/application/event-service";
import { changeMemberRole, listMembers, revokeMember, setMemberPermission, transferOwnership } from "@/modules/events/application/member-service";
import { buildEventIcs, createMilestone } from "@/modules/events/application/milestone-service";
import { acceptInvitation, changeProviderStatus, createExternalProvider, inviteMember, previewInvitation } from "@/modules/events/application/provider-service";
import { createTask, listTasks, toggleTask } from "@/modules/events/application/task-service";

const RUN = `itest-${randomUUID().slice(0, 8)}`;

function makeActor(key: string): Actor {
  return { userId: `${RUN}-${key}`, email: `${RUN}-${key}@sousnosailes.test`, name: key === "owner" ? "Olivia Owner" : key === "pro" ? "Marie Prestataire" : `Membre ${key}`, globalRole: "user", emailVerified: true, isDemo: true };
}

const owner = makeActor("owner");
const pro = makeActor("pro");
const other = makeActor("other");

async function insertUser(a: Actor) {
  await db.insert(users).values({ id: a.userId, name: a.name, email: a.email, emailVerified: true, isDemo: true }).onConflictDoNothing();
  await db.insert(userProfiles).values({ userId: a.userId, firstName: a.name.split(" ")[0] ?? "" }).onConflictDoNothing();
}

let eventId = "";

beforeAll(async () => {
  await Promise.all([owner, pro, other].map(insertUser));
});

afterAll(async () => {
  const ids = [owner.userId, pro.userId, other.userId];
  const mine = await db.select({ id: events.id }).from(events).where(inArray(events.ownerUserId, ids));
  if (mine.length) await db.delete(events).where(inArray(events.id, mine.map((e) => e.id)));
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, ids));
  await db.delete(notifications).where(inArray(notifications.userId, ids));
  await db.delete(emailOutbox).where(like(emailOutbox.toEmail, `${RUN}-%`));
  await db.delete(users).where(inArray(users.id, ids));
});

describe("events module (integration)", () => {
  it("creates the whole workspace in one go", async () => {
    const created = await createEvent(owner, {
      type: "wedding",
      name: `${RUN} Mariage test`,
      eventDate: "2027-06-12",
      dateIsTentative: false,
      startTime: "15:00",
      city: "Toulouse",
      postalCode: "31000",
      expectedGuests: 80,
      expectedChildren: 10,
      budgetCents: 2_000_000,
      wantedCategorySlugs: ["garde-enfants-evenementielle", "traiteur"],
      timezone: "Europe/Paris",
    });
    eventId = created.id;
    expect(created.wantedCategorySlugs.sort()).toEqual(["garde-enfants-evenementielle", "traiteur"]);

    const [ev] = await db.select().from(events).where(eq(events.id, eventId));
    expect(ev?.department).toBe("31");
    expect(ev?.startsAt?.toISOString()).toBe("2027-06-12T13:00:00.000Z"); // 15:00 Paris in June = 13:00Z

    const members = await db.select().from(eventMembers).where(eq(eventMembers.eventId, eventId));
    expect(members).toHaveLength(1);
    expect(members[0]?.role).toBe("owner");

    const templates = await db.select().from(checklistTemplates).where(and(eq(checklistTemplates.eventType, "wedding"), eq(checklistTemplates.isActive, true)));
    const tasks = await db.select().from(eventTasks).where(eq(eventTasks.eventId, eventId));
    expect(tasks).toHaveLength(templates.length);
    const venue = tasks.find((t) => t.title === "Choisir et réserver le lieu de réception");
    expect(venue?.dueDate).toBe("2026-06-12");

    const channels = await db.select().from(eventChannels).where(eq(eventChannels.eventId, eventId));
    expect(channels.map((c) => c.kind)).toEqual(["general"]);
    expect(channels[0]?.isOpenToAllMembers).toBe(true);

    expect(await db.select().from(eventBudgetLines).where(eq(eventBudgetLines.eventId, eventId))).toHaveLength(2);
    const slots = await db.select().from(eventProfessionals).where(eq(eventProfessionals.eventId, eventId));
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.status === "shortlisted" && s.professionalId === null)).toBe(true);

    const [cal] = await db.select().from(calendarEntries).where(eq(calendarEntries.eventId, eventId));
    expect(cal?.icalUid).toBe(`event-${eventId}@sousnosailes.fr`);
    expect(cal?.kind).toBe("event");

    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, owner.userId));
    expect(profile?.onboardingCompletedAt).not.toBeNull();

    const list = await listEventsForActor(owner);
    expect(list.some((e) => e.id === eventId && e.role === "owner")).toBe(true);
  });

  it("rejects invalid input and non-members", async () => {
    await expect(createEvent(owner, { type: "wedding", name: "x" })).rejects.toBeInstanceOf(ValidationError);
    await expect(getEventForMember(other, eventId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getEventForMember(owner, randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("invites a provider with a secure link and lets them join", async () => {
    const slotId = await createExternalProvider(owner, eventId, { externalName: "Marie Prestataire", externalEmail: pro.email, categorySlug: "garde-enfants-evenementielle" });
    const res = await inviteMember(owner, eventId, { email: pro.email, name: "Marie", role: "provider", categorySlug: "garde-enfants-evenementielle", eventProfessionalId: slotId.id });
    expect(res.expiresAt.getTime()).toBeGreaterThan(Date.now() + 13 * 86_400_000);

    // Only the hash is stored; the clear token lives in the e-mail link.
    const [tok] = await db.select().from(invitationTokens).where(eq(invitationTokens.invitationId, res.invitationId));
    expect(tok?.purpose).toBe("provider_join");
    const [mail] = await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, pro.email.toLowerCase()));
    const url = String(mail?.payload.url);
    const token = url.split("/app/invitations/")[1]!;
    expect(token.length).toBeGreaterThan(20);
    expect(tok?.tokenHash).not.toBe(token);

    const [slot] = await db.select().from(eventProfessionals).where(eq(eventProfessionals.id, slotId.id));
    expect(slot?.status).toBe("requested");

    const preview = await previewInvitation(token);
    expect(preview?.state).toBe("valid");
    expect(preview?.role).toBe("provider");

    // Not a member yet.
    expect(await getEventAccess(pro, eventId)).toBeNull();

    const joined = await acceptInvitation(pro, token);
    expect(joined.eventId).toBe(eventId);
    const access = await getEventAccess(pro, eventId);
    expect(access?.role).toBe("provider");
    expect(access?.categorySlug).toBe("garde-enfants-evenementielle");
    expect(access?.permissions.has("children.view_roster")).toBe(true);
    expect(access?.permissions.has("event.budget.view")).toBe(false);

    const [linked] = await db.select().from(eventProfessionals).where(eq(eventProfessionals.id, slotId.id));
    expect(linked?.memberId).toBe(access?.memberId);
    const [inv] = await db.select().from(invitations).where(eq(invitations.id, res.invitationId));
    expect(inv?.status).toBe("answered");

    // Token is single use.
    await expect(acceptInvitation(other, token)).rejects.toBeInstanceOf(ConflictError);
    // Organiser notified.
    const notifs = await db.select().from(notifications).where(and(eq(notifications.userId, owner.userId), eq(notifications.type, "invitation_accepted")));
    expect(notifs.length).toBeGreaterThan(0);
    // Provider joined the open channel.
    const [general] = await db.select().from(eventChannels).where(and(eq(eventChannels.eventId, eventId), eq(eventChannels.kind, "general")));
    const cm = await db.select().from(channelMembers).where(and(eq(channelMembers.channelId, general!.id), eq(channelMembers.memberId, access!.memberId)));
    expect(cm).toHaveLength(1);
  });

  it("filters tasks by visibility and lets managers toggle them", async () => {
    const task = await createTask(owner, eventId, { title: "Confirmer les horaires de garde", section: "Enfants", visibility: "team", priority: "high", dueDate: "2027-06-01" });
    const ownerView = await listTasks(owner, eventId);
    const proView = await listTasks(pro, eventId);
    expect(ownerView.tasks.length).toBeGreaterThan(proView.tasks.length);
    expect(proView.tasks.every((t) => t.visibility === "team")).toBe(true);
    expect(proView.tasks.some((t) => t.id === task.id)).toBe(true);
    // Provider role has tasks.view but not tasks.manage.
    await expect(toggleTask(pro, eventId, task.id, true)).rejects.toBeInstanceOf(ForbiddenError);
    await toggleTask(owner, eventId, task.id, true);
    const [row] = await db.select().from(eventTasks).where(eq(eventTasks.id, task.id));
    expect(row?.status).toBe("done");
    expect(row?.completedAt).not.toBeNull();
  });

  it("builds the planning, notifies concerned providers and exports ICS", async () => {
    await createMilestone(owner, eventId, { title: "Goûter des enfants", date: "2027-06-12", startTime: "16:30", endTime: "17:15", location: "La grange", categorySlugs: ["garde-enfants-evenementielle"] });
    await createMilestone(owner, eventId, { title: "Ouverture de bal", date: "2027-06-12", startTime: "22:30", endTime: "01:00", categorySlugs: ["dj"] });
    const n = await db.select().from(notifications).where(and(eq(notifications.userId, pro.userId), eq(notifications.type, "schedule_changed")));
    expect(n).toHaveLength(1); // deduplicated: only one notification even though two milestones changed
    const ics = await buildEventIcs(pro, eventId);
    expect(ics.body).toContain("SUMMARY:Goûter des enfants");
    expect(ics.body).toContain("DTSTART:20270612T143000Z"); // 16:30 Paris
    expect(ics.body).toContain("DTEND:20270612T230000Z"); // 01:00 next day rolls over
    expect(ics.body).toContain(`UID:event-${eventId}@sousnosailes.fr`);
    expect(ics.filename.endsWith(".ics")).toBe(true);
  });

  it("enforces provider status transitions", async () => {
    const [slot] = await db.select().from(eventProfessionals).where(and(eq(eventProfessionals.eventId, eventId), eq(eventProfessionals.externalName, "Marie Prestataire")));
    await changeProviderStatus(owner, eventId, slot!.id, "quoted");
    await changeProviderStatus(owner, eventId, slot!.id, "confirmed");
    await expect(changeProviderStatus(owner, eventId, slot!.id, "quoted")).rejects.toBeInstanceOf(ConflictError);
    await expect(changeProviderStatus(pro, eventId, slot!.id, "cancelled")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("computes the budget", async () => {
    const line = await createBudgetLine(owner, eventId, { category: "Enfants", label: "Garde", plannedCents: 100_000 });
    await createExpense(owner, eventId, { budgetLineId: line.id, label: "Acompte", amountCents: 30_000, status: "paid" });
    await createExpense(owner, eventId, { budgetLineId: line.id, label: "Solde", amountCents: 80_000, status: "committed" });
    const b = await getBudget(owner, eventId);
    const l = b.summary.lines.find((x) => x.id === line.id)!;
    expect(l.committedCents).toBe(110_000);
    expect(l.paidCents).toBe(30_000);
    expect(l.isOverrun).toBe(true);
    await expect(getBudget(pro, eventId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("manages members and explicit permissions with guard rails", async () => {
    const { members } = await listMembers(owner, eventId);
    const proMember = members.find((m) => m.userId === pro.userId)!;
    const ownerMember = members.find((m) => m.userId === owner.userId)!;
    // Explicit grant → effective immediately.
    await setMemberPermission(owner, eventId, proMember.id, { permission: "event.budget.view", effect: "allow" });
    expect((await getEventAccess(pro, eventId))?.permissions.has("event.budget.view")).toBe(true);
    // The provider cannot elevate themselves, nor touch the owner.
    await expect(setMemberPermission(pro, eventId, proMember.id, { permission: "event.delete", effect: "allow" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(changeMemberRole(pro, eventId, ownerMember.id, { role: "collaborator" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(revokeMember(owner, eventId, ownerMember.id)).rejects.toBeInstanceOf(ForbiddenError);
    // Audit + notification exist.
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.eventId, eventId), eq(auditLogs.action, "event.permission.set")));
    expect(logs.length).toBeGreaterThan(0);
    const n = await db.select().from(notifications).where(and(eq(notifications.userId, pro.userId), eq(notifications.type, "permission_changed")));
    expect(n.length).toBeGreaterThan(0);
  });

  it("runs the messaging with mentions, read markers and private channels", async () => {
    const { channels } = await listChannels(owner, eventId);
    const general = channels.find((c) => c.kind === "general")!;
    const posted = await postMessage(owner, eventId, general.id, { body: "Bienvenue @Marie, le planning est en ligne.", attachmentFileIds: [] });
    expect(posted.mentionedUserIds).toEqual([pro.userId]);
    const n = await db.select().from(notifications).where(and(eq(notifications.userId, pro.userId), eq(notifications.type, "new_message")));
    expect(n).toHaveLength(1);
    const proChannels = await listChannels(pro, eventId);
    expect(proChannels.channels.find((c) => c.id === general.id)?.unread).toBe(1);
    await markChannelRead(pro, eventId, general.id);
    expect((await listChannels(pro, eventId)).channels.find((c) => c.id === general.id)?.unread).toBe(0);
    const thread = await listMessages(pro, eventId, general.id);
    expect(thread.messages.at(-1)?.body).toContain("Bienvenue");

    // Private coordination channel: not visible to non-members, visible to organisers.
    const { members } = await listMembers(owner, eventId);
    const ownerMember = members.find((m) => m.userId === owner.userId)!;
    const priv = await createChannel(owner, eventId, { name: "Logistique", memberIds: [ownerMember.id], kind: "coordination" });
    await expect(listMessages(pro, eventId, priv.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(postMessage(pro, eventId, priv.id, { body: "coucou", attachmentFileIds: [] })).rejects.toBeInstanceOf(NotFoundError);
    expect((await listChannels(owner, eventId)).channels.some((c) => c.id === priv.id)).toBe(true);
  });

  it("aggregates the dashboard for both roles", async () => {
    const d = await getEventDashboard(owner, eventId);
    expect(d.providers.confirmed).toBe(1);
    expect(d.budget?.plannedCents).toBe(100_000);
    expect(d.tasks.total).toBeGreaterThan(0);
    const dp = await getEventDashboard(pro, eventId);
    expect(dp.budget).not.toBeNull(); // explicit grant earlier gave budget.view
    expect(dp.alerts).toEqual([]); // alerts are for organisers only
    expect(dp.invitations).toBeNull();
  });

  it("transfers ownership, changes status and soft-deletes", async () => {
    const { members } = await listMembers(owner, eventId);
    const proMember = members.find((m) => m.userId === pro.userId)!;
    await expect(transferOwnership(pro, eventId, proMember.id)).rejects.toBeInstanceOf(ForbiddenError);
    await transferOwnership(owner, eventId, proMember.id);
    expect((await getEventAccess(pro, eventId))?.role).toBe("owner");
    expect((await getEventAccess(owner, eventId))?.role).toBe("lead_organizer");
    await changeEventStatus(pro, eventId, "confirmed");
    await expect(changeEventStatus(pro, eventId, "archived")).resolves.toBeUndefined();
    await expect(changeEventStatus(pro, eventId, "planning")).rejects.toBeInstanceOf(ConflictError);
    // Only the owner deletes, with the exact name.
    await expect(deleteEvent(owner, eventId, `${RUN} Mariage test`)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteEvent(pro, eventId, "mauvais nom")).rejects.toBeInstanceOf(ValidationError);
    await deleteEvent(pro, eventId, `${RUN} Mariage test`);
    await expect(getEventForMember(pro, eventId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getEventForMember(owner, eventId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("has reference categories available (sanity)", async () => {
    const [c] = await db.select().from(professionalCategories).where(eq(professionalCategories.slug, "traiteur"));
    expect(c).toBeDefined();
  });
});
