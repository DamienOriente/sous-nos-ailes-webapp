import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { notificationPreferences, notifications, users } from "@/db/schema";
import { enqueueEmail } from "@/modules/notifications/application/email-outbox";
import { isNotificationType, type NotificationItem, type NotificationType } from "@/modules/notifications/domain/types";

export { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES, isNotificationType } from "@/modules/notifications/domain/types";
export type { NotificationItem, NotificationType } from "@/modules/notifications/domain/types";

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  eventId?: string;
  /** Same key within 10 minutes → not duplicated. */
  dedupeKey?: string;
  /** Force or skip the e-mail regardless of preferences (e.g. security). */
  email?: "auto" | "always" | "never";
};

const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Persist an in-app notification and, according to user preferences, queue a
 * transactional e-mail. Never pass health data or document contents in `body`.
 */
export async function notify(input: NotifyInput, executor: DbExecutor = db): Promise<{ created: boolean }> {
  if (input.dedupeKey) {
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const [dup] = await executor
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, input.userId), eq(notifications.dedupeKey, input.dedupeKey), gt(notifications.createdAt, since)))
      .limit(1);
    if (dup) return { created: false };
  }
  const [row] = await executor
    .insert(notifications)
    .values({ userId: input.userId, type: input.type, title: input.title, body: input.body ?? null, href: input.href ?? null, eventId: input.eventId ?? null, dedupeKey: input.dedupeKey ?? null })
    .returning({ id: notifications.id });

  const mode = input.email ?? "auto";
  if (mode === "never") return { created: true };
  const [pref] = await executor.select().from(notificationPreferences).where(eq(notificationPreferences.userId, input.userId)).limit(1);
  const typeEnabled = pref?.types?.[input.type] ?? true;
  const shouldEmail = mode === "always" || ((pref?.emailEnabled ?? true) && typeEnabled && (pref?.emailDigest ?? "immediate") === "immediate");
  if (shouldEmail) {
    const [u] = await executor.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (u) {
      await enqueueEmail(
        {
          toEmail: u.email,
          templateKey: "notification",
          subject: input.title,
          payload: { name: u.name, title: input.title, body: input.body ?? "", href: input.href ?? "/app/notifications", notificationId: row?.id },
        },
        executor,
      );
      if (row) await executor.update(notifications).set({ emailedAt: new Date() }).where(eq(notifications.id, row.id));
    }
  }
  return { created: true };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function listNotifications(userId: string, limit = 50) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export type NotificationRow = typeof notifications.$inferSelect;
export function toNotificationItem(n: Pick<NotificationRow, "id" | "type" | "title" | "body" | "href" | "readAt" | "createdAt">): NotificationItem {
  return { id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() };
}
export type NotificationFilter = { type?: NotificationType; unreadOnly?: boolean };
export type NotificationPage = { items: NotificationRow[]; nextOffset: number | null; total: number; unread: number };

/**
 * Paginated feed for the notification centre: unread first, then newest.
 * Offset based ("charger plus"), bounded page size.
 */
export async function listNotificationsPage(userId: string, opts: NotificationFilter & { offset?: number; limit?: number } = {}): Promise<NotificationPage> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = [eq(notifications.userId, userId)];
  if (opts.type) where.push(eq(notifications.type, opts.type));
  if (opts.unreadOnly) where.push(isNull(notifications.readAt));
  const condition = and(...where);
  const [items, [count], [unreadRow]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(condition)
      .orderBy(asc(sql`case when ${notifications.readAt} is null then 0 else 1 end`), desc(notifications.createdAt))
      .limit(limit + 1)
      .offset(offset),
    db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(condition),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(condition, isNull(notifications.readAt))),
  ]);
  const hasMore = items.length > limit;
  return { items: hasMore ? items.slice(0, limit) : items, nextOffset: hasMore ? offset + limit : null, total: count?.n ?? 0, unread: unreadRow?.n ?? 0 };
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function markNotificationUnread(userId: string, id: string): Promise<void> {
  await db.update(notifications).set({ readAt: null }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: string, filter: NotificationFilter = {}): Promise<number> {
  const where = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (filter.type) where.push(eq(notifications.type, filter.type));
  const res = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...where))
    .returning({ id: notifications.id });
  return res.length;
}

// ── Preferences ─────────────────────────────────────────────────────────────
export type NotificationPreferences = {
  emailEnabled: boolean;
  emailDigest: "immediate" | "daily" | "off";
  types: Record<string, boolean>;
  marketingEmails: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = { emailEnabled: true, emailDigest: "immediate", types: {}, marketingEmails: false };

export async function getNotificationPreferences(userId: string, executor: DbExecutor = db): Promise<NotificationPreferences> {
  const [row] = await executor.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  if (!row) return { ...DEFAULT_PREFERENCES };
  const digest = row.emailDigest === "daily" || row.emailDigest === "off" ? row.emailDigest : "immediate";
  return { emailEnabled: row.emailEnabled, emailDigest: digest, types: row.types ?? {}, marketingEmails: row.marketingEmails };
}

/** Upsert; only the provided keys change. `types` entries are merged (true/false per NotificationType). */
export async function updateNotificationPreferences(userId: string, prefs: Partial<NotificationPreferences>, executor: DbExecutor = db): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId, executor);
  const types = { ...current.types };
  for (const [k, v] of Object.entries(prefs.types ?? {})) if (isNotificationType(k)) types[k] = Boolean(v);
  const next: NotificationPreferences = {
    emailEnabled: prefs.emailEnabled ?? current.emailEnabled,
    emailDigest: prefs.emailDigest ?? current.emailDigest,
    types,
    marketingEmails: prefs.marketingEmails ?? current.marketingEmails,
  };
  await executor
    .insert(notificationPreferences)
    .values({ userId, ...next })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: { ...next, updatedAt: new Date() } });
  return next;
}
