import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { db } from "@/db/client";
import { contacts, emailOutbox, eventGuests, eventMembers, events, invitationCheckins, invitationTokens, notifications, plans, subscriptions, users } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, PaymentRequiredError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { createContact, getContact } from "@/modules/contacts/application/contact-service";
import { createGuest, getGuestStats, importGuests } from "@/modules/guests/application/guest-service";
import {
  createInvitation,
  getInvitationDetail,
  getOrCreateCheckinQr,
  getRsvpLink,
  listInvitations,
  remindInvitation,
  resolvePublicInvitation,
  revokeInvitation,
  sendInvitation,
  submitPublicRsvp,
  validateCheckin,
} from "@/modules/invitations/application/invitation-service";
import { assignGuest, createTable, getSeatingPlan, moveGuest } from "@/modules/seating/application/seating-service";

const PREFIX = "itest-guests";

async function actorFor(email: string): Promise<Actor> {
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u) throw new Error(`demo user ${email} missing (run pnpm db:seed)`);
  return { userId: u.id, email: u.email, name: u.name, globalRole: "user", emailVerified: true, isDemo: true };
}

async function createEvent(owner: Actor, name: string): Promise<string> {
  const [e] = await db.insert(events).values({ ownerUserId: owner.userId, name, type: "wedding", eventDate: "2027-06-12", venueName: "Domaine test", city: "Lavaur", isDemo: true }).returning({ id: events.id });
  await db.insert(eventMembers).values({ eventId: e!.id, userId: owner.userId, role: "owner", status: "active", joinedAt: new Date() });
  return e!.id;
}

const tokenFromUrl = (url: string) => url.split("/").pop()!;

let louis: Actor;
let paul: Actor;
let eventA: string;
let eventB: string;
let subscriptionId: string | null = null;

beforeAll(async () => {
  louis = await actorFor("louis@sousnosailes.test");
  paul = await actorFor("paul@sousnosailes.test");
  await db.delete(events).where(like(events.name, `${PREFIX}%`));
  eventA = await createEvent(louis, `${PREFIX} A`);
  eventB = await createEvent(paul, `${PREFIX} B`);
  // Premium for the owner of A (QR codes + seating plan).
  const [plus] = await db.select({ id: plans.id }).from(plans).where(eq(plans.key, "organizer_plus")).limit(1);
  const [existing] = await db.select({ id: subscriptions.id }).from(subscriptions).where(and(eq(subscriptions.userId, louis.userId), eq(subscriptions.planId, plus!.id), eq(subscriptions.status, "active"))).limit(1);
  if (!existing) {
    const [s] = await db.insert(subscriptions).values({ userId: louis.userId, planId: plus!.id, status: "active", provider: "mock", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86_400_000) }).returning({ id: subscriptions.id });
    subscriptionId = s!.id;
  }
});

afterAll(async () => {
  await db.delete(events).where(like(events.name, `${PREFIX}%`));
  await db.delete(contacts).where(like(contacts.lastName, `${PREFIX}%`));
  await db.delete(emailOutbox).where(like(emailOutbox.subject, `%${PREFIX}%`));
  await db.delete(notifications).where(and(eq(notifications.userId, louis.userId), like(notifications.title, `${PREFIX}%`)));
  if (subscriptionId) await db.delete(subscriptions).where(eq(subscriptions.id, subscriptionId));
});

describe("invitations: RSVP flow", () => {
  it("creates an invitation with an RSVP token, answers publicly, updates guests and notifies", async () => {
    const g1 = await createGuest(louis, eventA, { firstName: "Claire", lastName: "Dubois", plusOnesAllowed: 1 });
    const g2 = await createGuest(louis, eventA, { firstName: "Emma", lastName: "Dubois", isChild: true, ageYears: 9 });
    const inv = await createInvitation(louis, eventA, { kind: "family", templateKey: "classic", recipientName: `${PREFIX} Famille Dubois`, recipientEmail: "dubois@example.test", guestIds: [g1.id, g2.id] });
    expect(inv.status).toBe("draft");
    expect(inv.expiresAt?.toISOString()).toBe("2027-06-19T23:59:59.000Z");

    const link = await getRsvpLink(louis, eventA, inv.id);
    const token = tokenFromUrl(link);
    const view = await resolvePublicInvitation(token);
    expect(view.outcome).toBe("valid");
    expect(view.guests.map((g) => g.firstName).sort()).toEqual(["Claire", "Emma"]);
    expect(view.event?.name).toBe(`${PREFIX} A`);

    await submitPublicRsvp(token, { status: "accepted", guestsCount: 3, message: "On arrive !", perGuest: { [g1.id]: "accepted", [g2.id]: "accepted" } }, "127.0.0.1");
    const detail = await getInvitationDetail(louis, eventA, inv.id);
    expect(detail.invitation.status).toBe("answered");
    expect(detail.responses).toHaveLength(1);
    expect(detail.responses[0]!.guestsCount).toBe(3);
    const guests = await db.select().from(eventGuests).where(inArray(eventGuests.id, [g1.id, g2.id]));
    expect(guests.every((g) => g.rsvpStatus === "accepted")).toBe(true);
    const stats = await getGuestStats(louis, eventA);
    expect(stats.accepted).toBe(2);
    expect(stats.children).toBe(1);
    const notifs = await db.select().from(notifications).where(and(eq(notifications.userId, louis.userId), eq(notifications.dedupeKey, `rsvp:${inv.id}`)));
    expect(notifs).toHaveLength(1);

    // Second answer within the dedupe window: recorded, but no duplicate notification.
    await submitPublicRsvp(token, { status: "declined", guestsCount: 0 }, "127.0.0.1");
    const again = await db.select().from(notifications).where(and(eq(notifications.userId, louis.userId), eq(notifications.dedupeKey, `rsvp:${inv.id}`)));
    expect(again).toHaveLength(1);
    const [g1after] = await db.select().from(eventGuests).where(eq(eventGuests.id, g1.id));
    expect(g1after?.rsvpStatus).toBe("declined");
  });

  it("sends by e-mail (outbox), applies the reminder policy", async () => {
    const inv = await createInvitation(louis, eventA, { kind: "individual", templateKey: "classic", recipientName: `${PREFIX} Solo`, recipientEmail: "solo@example.test" });
    const sent = await sendInvitation(louis, eventA, inv.id);
    expect(sent.status).toBe("sent");
    const mails = await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, "solo@example.test"));
    expect(mails.length).toBeGreaterThanOrEqual(1);
    expect(mails[0]!.templateKey).toBe("invitation");
    expect(String(mails[0]!.payload.url)).toContain("/invitation/");
    await expect(remindInvitation(louis, eventA, inv.id)).rejects.toBeInstanceOf(ConflictError); // too soon
    const later = new Date(Date.now() + 8 * 86_400_000);
    const reminded = await remindInvitation(louis, eventA, inv.id, later);
    expect(reminded.reminderCount).toBe(1);
    await expect(sendInvitation(louis, eventA, inv.id)).rejects.toBeInstanceOf(ConflictError); // already sent
    await db.delete(emailOutbox).where(eq(emailOutbox.toEmail, "solo@example.test"));
  });

  it("rejects public answers on revoked/unknown tokens", async () => {
    const inv = await createInvitation(louis, eventA, { kind: "individual", templateKey: "classic", recipientName: `${PREFIX} Revoked` });
    const token = tokenFromUrl(await getRsvpLink(louis, eventA, inv.id));
    await revokeInvitation(louis, eventA, inv.id, "test");
    expect((await resolvePublicInvitation(token)).outcome).toBe("revoked");
    await expect(submitPublicRsvp(token, { status: "accepted", guestsCount: 1 }, null)).rejects.toBeInstanceOf(ConflictError);
    expect((await resolvePublicInvitation("definitely-not-a-token-0000000000")).outcome).toBe("invalid");
    await expect(submitPublicRsvp("definitely-not-a-token-0000000000", { status: "accepted", guestsCount: 1 }, null)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getRsvpLink(louis, eventA, inv.id)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("invitations: check-in", () => {
  it("accepts once, then reports a duplicate; revocation kills the QR; event isolation", async () => {
    const guest = await createGuest(louis, eventA, { firstName: "Bernard", lastName: "Marchand" });
    const inv = await createInvitation(louis, eventA, { kind: "individual", templateKey: "rustic", recipientName: `${PREFIX} Bernard`, guestIds: [guest.id] });
    const qr = await getOrCreateCheckinQr(louis, eventA, inv.id);
    expect(qr.url).toMatch(/\/c\/[A-Za-z0-9_-]{20,}$/);
    expect(qr.pngDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(qr.svg).toContain("<svg");
    // Stable: asking again returns the same code.
    expect((await getOrCreateCheckinQr(louis, eventA, inv.id)).url).toBe(qr.url);

    const first = await validateCheckin(louis, eventA, qr.url);
    expect(first.result).toBe("accepted");
    expect(first.invitation?.recipientName).toBe(`${PREFIX} Bernard`);
    expect(first.invitation?.expectedCount).toBe(1);
    const second = await validateCheckin(louis, eventA, tokenFromUrl(qr.url));
    expect(second.result).toBe("duplicate");
    expect(second.previousScanAt).not.toBeNull();

    // Same token presented in another event: invalid, no leak of the invitation.
    const cross = await validateCheckin(paul, eventB, qr.url);
    expect(cross.result).toBe("invalid");
    expect(cross.invitation).toBeNull();

    const regenerated = await getOrCreateCheckinQr(louis, eventA, inv.id, { regenerate: true });
    expect(regenerated.regenerated).toBe(true);
    expect(regenerated.url).not.toBe(qr.url);
    expect((await validateCheckin(louis, eventA, qr.url)).result).toBe("revoked");
    expect((await validateCheckin(louis, eventA, regenerated.url)).result).toBe("accepted");

    await revokeInvitation(louis, eventA, inv.id);
    expect((await validateCheckin(louis, eventA, regenerated.url)).result).toBe("revoked");
    const tokens = await db.select().from(invitationTokens).where(eq(invitationTokens.invitationId, inv.id));
    expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
    const history = await db.select().from(invitationCheckins).where(eq(invitationCheckins.eventId, eventA));
    expect(history.filter((h) => h.result === "accepted")).toHaveLength(2);
    expect((await validateCheckin(louis, eventA, "garbage")).result).toBe("invalid");
  });

  it("QR codes require the premium entitlement (owner of B is on the free plan)", async () => {
    const inv = await createInvitation(paul, eventB, { kind: "individual", templateKey: "classic", recipientName: `${PREFIX} Free` });
    await expect(getOrCreateCheckinQr(paul, eventB, inv.id)).rejects.toBeInstanceOf(PaymentRequiredError);
    await expect(createInvitation(paul, eventB, { kind: "individual", templateKey: "modern", recipientName: `${PREFIX} Free 2` })).rejects.toBeInstanceOf(PaymentRequiredError);
  });
});

describe("permissions & isolation", () => {
  it("non-members get NotFound, members without the permission get Forbidden", async () => {
    await expect(listInvitations(paul, eventA)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createGuest(paul, eventA, { firstName: "Intrus" })).rejects.toBeInstanceOf(NotFoundError);
    await db.insert(eventMembers).values({ eventId: eventA, userId: paul.userId, role: "guest", status: "active", joinedAt: new Date() });
    await expect(listInvitations(paul, eventA)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(validateCheckin(paul, eventA, "x")).rejects.toBeInstanceOf(ForbiddenError);
    await db.delete(eventMembers).where(and(eq(eventMembers.eventId, eventA), eq(eventMembers.userId, paul.userId)));
  });

  it("rejects guest ids from another event inside an invitation", async () => {
    const foreign = await createGuest(paul, eventB, { firstName: "Étranger" });
    await expect(createInvitation(louis, eventA, { kind: "individual", templateKey: "classic", recipientName: `${PREFIX} X`, guestIds: [foreign.id] })).rejects.toThrow(/n'appartiennent pas/);
  });

  it("contacts: another user cannot read a private contact (IDOR)", async () => {
    const c = await createContact(louis, { firstName: "Privé", lastName: `${PREFIX} Contact`, email: "prive@example.test" });
    await expect(getContact(paul, c.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getContact(louis, c.id)).id).toBe(c.id);
  });
});

describe("guests & seating", () => {
  it("imports guests with auto-created groups and seats them with the unique constraint", async () => {
    const res = await importGuests(louis, eventA, [
      { line: 2, firstName: "Alain", lastName: "Bertrand", email: null, phone: null, groupName: "Famille de Lisa", isChild: false, ageYears: null, dietaryPreference: null, plusOnesAllowed: 1, notes: null },
      { line: 3, firstName: "Zoé", lastName: "Bertrand", email: null, phone: null, groupName: "famille de lisa", isChild: true, ageYears: 5, dietaryPreference: null, plusOnesAllowed: 0, notes: null },
    ]);
    expect(res).toEqual({ created: 2, groupsCreated: 1 });
    const table = await createTable(louis, eventA, { name: "Table 1", shape: "round", capacity: 2 });
    const table2 = await createTable(louis, eventA, { name: "Table 2", shape: "rectangle", capacity: 8 });
    const plan = await getSeatingPlan(louis, eventA);
    const alain = plan.unplaced.find((g) => g.firstName === "Alain")!;
    const zoe = plan.unplaced.find((g) => g.firstName === "Zoé")!;
    expect((await assignGuest(louis, eventA, alain.id, table.id)).occupancy).toEqual({ used: 1, free: 1, over: 0, isOver: false });
    await expect(assignGuest(louis, eventA, alain.id, table2.id)).rejects.toBeInstanceOf(ConflictError);
    await assignGuest(louis, eventA, zoe.id, table.id);
    const moved = await moveGuest(louis, eventA, alain.id, table2.id);
    expect(moved.occupancy.used).toBe(1);
    const after = await getSeatingPlan(louis, eventA);
    expect(after.tables.find((t) => t.id === table.id)?.guests.map((g) => g.firstName)).toEqual(["Zoé"]);
    expect(after.tables.find((t) => t.id === table2.id)?.guests.map((g) => g.firstName)).toEqual(["Alain"]);
    // Seating plan is premium: event B's owner is on the free plan.
    await expect(createTable(paul, eventB, { name: "Nope", shape: "round", capacity: 4 })).rejects.toBeInstanceOf(PaymentRequiredError);
  });
});
