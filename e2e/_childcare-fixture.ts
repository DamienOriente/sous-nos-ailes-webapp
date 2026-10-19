import { and, eq } from "drizzle-orm";
import type { Page } from "@playwright/test";
import { db } from "@/db/client";
import { eventMembers, events, professionalCategories, users } from "@/db/schema";
import { seed as seedChildren } from "@/db/seed/children";
import { seed as seedCalendar } from "@/db/seed/calendar";
import type { SeedContext } from "@/db/seed/context";
import { login } from "./_auth";

/**
 * E2E fixture: ensures a demo wedding with Louis (owner), Marie (childcare
 * provider), Nora (childcare staff), Julien (caterer) and Théo (DJ) exists,
 * then runs the children + calendar demo seeds against it. Independent from
 * the events module seed (re-uses the same event when it is present).
 */
const EMAILS = { louis: "louis@sousnosailes.test", lisa: "lisa@sousnosailes.test", marie: "marie.garde@sousnosailes.test", nora: "nora.nounou@sousnosailes.test", julien: "julien.traiteur@sousnosailes.test", theo: "theo.dj@sousnosailes.test", helene: "helene.domaine@sousnosailes.test", paul: "paul@sousnosailes.test", sofia: "sofia.anim@sousnosailes.test", ines: "ines.photo@sousnosailes.test" } as const;

export async function ensureDemoEvent(): Promise<{ eventId: string; users: Record<string, string> }> {
  const userIds: Record<string, string> = {};
  for (const [key, email] of Object.entries(EMAILS)) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!u) throw new Error(`demo user ${email} missing: run pnpm db:seed first`);
    userIds[key] = u.id;
  }
  let [event] = await db.select({ id: events.id }).from(events).where(and(eq(events.ownerUserId, userIds.louis!), eq(events.name, "Mariage de Louis et Lisa"))).limit(1);
  if (!event) {
    [event] = await db
      .insert(events)
      .values({ ownerUserId: userIds.louis!, name: "Mariage de Louis et Lisa", type: "wedding", eventDate: "2027-06-12", startsAt: new Date("2027-06-12T13:00:00Z"), endsAt: new Date("2027-06-13T02:00:00Z"), venueName: "Domaine d'Hélène", city: "Lavaur", isDemo: true })
      .returning({ id: events.id });
  }
  const eventId = event!.id;
  const cat = async (slug: string) => (await db.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, slug)).limit(1))[0]!.id;
  const members: Array<{ key: string; role: "owner" | "co_organizer" | "provider" | "staff"; category?: string }> = [
    { key: "louis", role: "owner" },
    { key: "lisa", role: "co_organizer" },
    { key: "marie", role: "provider", category: "garde-enfants-evenementielle" },
    { key: "nora", role: "staff", category: "garde-enfants-evenementielle" },
    { key: "julien", role: "provider", category: "traiteur" },
    { key: "theo", role: "provider", category: "dj" },
    { key: "helene", role: "provider", category: "domaine-reception" },
    { key: "ines", role: "provider", category: "photographe" },
  ];
  const memberIds: Record<string, string> = {};
  for (const m of members) {
    const [existing] = await db.select({ id: eventMembers.id }).from(eventMembers).where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userIds[m.key]!))).limit(1);
    if (existing) {
      memberIds[`louisLisa:${m.key}`] = existing.id;
      continue;
    }
    const [row] = await db
      .insert(eventMembers)
      .values({ eventId, userId: userIds[m.key]!, role: m.role, status: "active", categoryId: m.category ? await cat(m.category) : null, joinedAt: new Date() })
      .returning({ id: eventMembers.id });
    memberIds[`louisLisa:${m.key}`] = row!.id;
  }
  const ctx: SeedContext = { db, now: new Date(), users: userIds, categories: {}, plans: {}, professionals: {}, events: { louisLisa: eventId }, members: memberIds };
  await seedChildren(ctx);
  await seedCalendar(ctx);
  return { eventId, users: userIds };
}

export async function closeDb(): Promise<void> {
  // The pool is shared by every spec of the Playwright worker: never end it here.
}

/** Signs in through better-auth's API (shared helper: cached sessions + retry on the 5/min rate limit). */
export async function signIn(page: Page, email: string): Promise<void> {
  await login(page, email);
}

export { EMAILS };
