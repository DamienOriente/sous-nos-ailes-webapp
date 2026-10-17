import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventMembers, events, mediaAssets, notifications, professionalCategories, professionals, users } from "@/db/schema";
import type { Actor } from "@/lib/session";
import { deriveNextActions, type NextAction } from "@/modules/identity/domain/next-actions";
import { isPrivilegedRole } from "@/modules/identity/domain/security";

export type HomeEvent = {
  id: string;
  name: string;
  type: string;
  status: string;
  eventDate: string | null;
  dateIsTentative: boolean;
  city: string | null;
  venueName: string | null;
  expectedGuests: number | null;
  expectedChildren: number | null;
  role: string;
  timezone: string;
};

export type HomeProfessional = {
  id: string;
  displayName: string;
  slug: string;
  status: string;
  city: string | null;
  completenessScore: number;
  categorySlug: string | null;
  categoryName: string | null;
  /** Cover picture uploaded by the professional (media_assets kind "cover"), if any. */
  coverFileId: string | null;
};

export type HomeNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: Date;
};

export type HomeDashboard = {
  firstName: string;
  timezone: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  /** True when the account role requires 2FA and it is not enabled yet. */
  twoFactorRequiredButMissing: boolean;
  upcomingEvents: HomeEvent[];
  professionals: HomeProfessional[];
  unreadNotifications: HomeNotification[];
  unreadCount: number;
  nextActions: NextAction[];
  /** Days until the first dated upcoming event (0 = today), null when none. */
  nextEventInDays: number | null;
  isEmpty: boolean;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Read model for /app. Isolation: events through the actor's own active
 * membership, listings through ownerUserId — never by id supplied by the client.
 */
export async function getHomeDashboard(actor: Actor, executor: DbExecutor = db): Promise<HomeDashboard> {
  const [userRow] = await executor
    .select({ name: users.name, timezone: users.timezone, emailVerified: users.emailVerified, twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);

  const upcomingEvents = await executor
    .select({
      id: events.id,
      name: events.name,
      type: events.type,
      status: events.status,
      eventDate: events.eventDate,
      dateIsTentative: events.dateIsTentative,
      city: events.city,
      venueName: events.venueName,
      expectedGuests: events.expectedGuests,
      expectedChildren: events.expectedChildren,
      role: eventMembers.role,
      timezone: events.timezone,
    })
    .from(eventMembers)
    .innerJoin(events, eq(events.id, eventMembers.eventId))
    .where(
      and(
        eq(eventMembers.userId, actor.userId),
        eq(eventMembers.status, "active"),
        isNull(events.deletedAt),
        sql`${events.status} not in ('cancelled', 'archived')`,
        or(isNull(events.eventDate), gte(events.eventDate, todayIso())),
      ),
    )
    .orderBy(sql`${events.eventDate} asc nulls last`, asc(events.createdAt))
    .limit(5);

  const proRows = await executor
    .select({
      id: professionals.id,
      displayName: professionals.displayName,
      slug: professionals.slug,
      status: professionals.status,
      city: professionals.city,
      completenessScore: professionals.completenessScore,
      categorySlug: professionalCategories.slug,
      categoryName: professionalCategories.name,
    })
    .from(professionals)
    .leftJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(and(eq(professionals.ownerUserId, actor.userId), isNull(professionals.deletedAt)))
    .orderBy(desc(professionals.updatedAt))
    .limit(5);

  const covers = proRows.length
    ? await executor
        .select({ professionalId: mediaAssets.professionalId, fileId: mediaAssets.fileId })
        .from(mediaAssets)
        .where(and(inArray(mediaAssets.professionalId, proRows.map((p) => p.id)), eq(mediaAssets.kind, "cover")))
        .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.createdAt))
    : [];
  const coverByPro = new Map<string, string>();
  for (const c of covers) if (!coverByPro.has(c.professionalId)) coverByPro.set(c.professionalId, c.fileId);
  const pros: HomeProfessional[] = proRows.map((p) => ({ ...p, coverFileId: coverByPro.get(p.id) ?? null }));

  const unread = await executor
    .select({ id: notifications.id, type: notifications.type, title: notifications.title, body: notifications.body, href: notifications.href, createdAt: notifications.createdAt })
    .from(notifications)
    .where(and(eq(notifications.userId, actor.userId), isNull(notifications.readAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(5);

  const [count] = await executor
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, actor.userId), isNull(notifications.readAt)));

  const twoFactorEnabled = userRow?.twoFactorEnabled ?? false;
  const emailVerified = userRow?.emailVerified ?? actor.emailVerified;
  const twoFactorRequiredButMissing = isPrivilegedRole(actor.globalRole) && !twoFactorEnabled;
  const unreadCount = count?.n ?? 0;
  const firstDated = upcomingEvents.find((e) => e.eventDate);
  const nextEventInDays = firstDated?.eventDate ? Math.max(0, Math.round((new Date(`${firstDated.eventDate}T12:00:00Z`).getTime() - Date.now()) / 86_400_000)) : null;
  return {
    firstName: (userRow?.name ?? actor.name).split(/\s+/)[0] ?? actor.name,
    timezone: userRow?.timezone ?? "Europe/Paris",
    emailVerified,
    twoFactorEnabled,
    twoFactorRequiredButMissing,
    upcomingEvents,
    professionals: pros,
    unreadNotifications: unread,
    unreadCount,
    nextEventInDays,
    nextActions: deriveNextActions({ today: new Date(), emailVerified, twoFactorRequiredButMissing, unreadCount, events: upcomingEvents, professionals: pros }),
    isEmpty: upcomingEvents.length === 0 && pros.length === 0,
  };
}
