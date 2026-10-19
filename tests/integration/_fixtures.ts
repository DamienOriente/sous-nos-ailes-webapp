import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { eventMembers, events, professionalCategories, users } from "@/db/schema";
import type { Actor } from "@/lib/session";

/**
 * Minimal fixtures for integration tests (childcare + calendar). Rows are
 * prefixed "itest-" and removed in cleanup(). Users are inserted directly
 * (no better-auth) because services only need an Actor.
 */
export type Fixture = {
  users: Record<string, Actor>;
  events: Record<string, string>;
  members: Record<string, string>;
  cleanup: () => Promise<void>;
};

export async function createUser(key: string, role: Actor["globalRole"] = "user"): Promise<Actor> {
  const id = `itest-${key}-${randomUUID().slice(0, 8)}`;
  const email = `${id}@sousnosailes.test`;
  await db.insert(users).values({ id, name: `Test ${key}`, email, emailVerified: true, role, isDemo: true });
  return { userId: id, email, name: `Test ${key}`, globalRole: role, emailVerified: true, isDemo: true };
}

export async function createEvent(owner: Actor, name: string): Promise<string> {
  const [row] = await db
    .insert(events)
    .values({ ownerUserId: owner.userId, name: `itest ${name}`, type: "wedding", eventDate: "2027-06-12", startsAt: new Date("2027-06-12T12:00:00Z"), endsAt: new Date("2027-06-13T02:00:00Z"), isDemo: true })
    .returning({ id: events.id });
  await db.insert(eventMembers).values({ eventId: row!.id, userId: owner.userId, role: "owner", status: "active", joinedAt: new Date() });
  return row!.id;
}

export async function addMember(eventId: string, actor: Actor, role: "co_organizer" | "wedding_planner" | "provider" | "staff" | "collaborator", categorySlug?: string): Promise<string> {
  let categoryId: string | null = null;
  if (categorySlug) {
    const [c] = await db.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, categorySlug)).limit(1);
    if (!c) throw new Error(`category ${categorySlug} missing: run the reference seed first`);
    categoryId = c.id;
  }
  const [row] = await db.insert(eventMembers).values({ eventId, userId: actor.userId, role, status: "active", categoryId, joinedAt: new Date() }).returning({ id: eventMembers.id });
  return row!.id;
}

export async function cleanupUsers(actors: Actor[]): Promise<void> {
  const ids = actors.map((a) => a.userId);
  if (!ids.length) return;
  // Events owned by test users are restricted-delete: remove them first (cascades children, members, tools).
  await db.delete(events).where(inArray(events.ownerUserId, ids));
  await db.delete(users).where(inArray(users.id, ids));
}
