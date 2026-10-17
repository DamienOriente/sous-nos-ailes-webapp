import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { auditLogs, channelMembers, eventChannels, eventMembers, eventPermissions, eventProfessionals, events, professionalCategories, users } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { EVENT_PERMISSIONS, EVENT_ROLE_LABELS, EVENT_ROLE_PERMISSIONS, requireEventMember, requireEventPermission, resolveEventPermissions, TRADE_PERMISSIONS, type EventAccess, type EventPermission, type EventRole } from "@/modules/authorization";
import { recordAudit } from "@/modules/events/application/audit";
import { ASSIGNABLE_ROLES } from "@/modules/events/domain/providers";
import { permissionLabel } from "@/modules/events/domain/permission-labels";
import { notify } from "@/modules/notifications/application/notification-service";

export type MemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  role: EventRole;
  status: "invited" | "active" | "revoked" | "left";
  categoryName: string | null;
  categorySlug: string | null;
  professionalId: string | null;
  title: string | null;
  joinedAt: Date | null;
  revokedAt: Date | null;
  overrides: Array<{ id: string; permission: string; effect: "allow" | "deny"; expiresAt: Date | null; grantedByName: string | null }>;
  effective: EventPermission[];
  isSelf: boolean;
};

export async function listMembers(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<{ access: EventAccess; members: MemberRow[]; ownerUserId: string }> {
  const access = await requireEventPermission(actor, eventId, "event.members.view", executor);
  const [ev] = await executor.select({ ownerUserId: events.ownerUserId }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!ev) throw new NotFoundError();
  const canSeeContacts = access.permissions.has("event.members.manage");
  const rows = await executor
    .select({ m: eventMembers, name: users.name, email: users.email, categoryName: professionalCategories.name, categorySlug: professionalCategories.slug })
    .from(eventMembers)
    .innerJoin(users, eq(users.id, eventMembers.userId))
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventMembers.categoryId))
    .where(eq(eventMembers.eventId, eventId))
    .orderBy(asc(eventMembers.status), asc(users.name));
  const overrides = await executor
    .select({ id: eventPermissions.id, memberId: eventPermissions.memberId, permission: eventPermissions.permission, effect: eventPermissions.effect, expiresAt: eventPermissions.expiresAt, grantedByName: users.name })
    .from(eventPermissions)
    .leftJoin(users, eq(users.id, eventPermissions.grantedByUserId))
    .where(eq(eventPermissions.eventId, eventId));
  const members = rows.map((r) => {
    const mine = overrides.filter((o) => o.memberId === r.m.id);
    return {
      id: r.m.id,
      userId: r.m.userId,
      name: r.name,
      email: canSeeContacts ? r.email : null,
      role: r.m.role,
      status: r.m.status,
      categoryName: r.categoryName,
      categorySlug: r.categorySlug,
      professionalId: r.m.professionalId,
      title: r.m.title,
      joinedAt: r.m.joinedAt,
      revokedAt: r.m.revokedAt,
      overrides: access.permissions.has("event.permissions.manage") ? mine.map((o) => ({ id: o.id, permission: o.permission, effect: o.effect, expiresAt: o.expiresAt, grantedByName: o.grantedByName })) : [],
      effective: [...resolveEventPermissions({ role: r.m.role, categorySlug: r.categorySlug, overrides: mine })],
      isSelf: r.m.userId === actor.userId,
    };
  });
  return { access, members, ownerUserId: ev.ownerUserId };
}

async function loadMember(eventId: string, memberId: string, executor: DbExecutor) {
  const [m] = await executor.select().from(eventMembers).where(and(eq(eventMembers.id, memberId), eq(eventMembers.eventId, eventId))).limit(1);
  if (!m) throw new NotFoundError();
  return m;
}

export const changeRoleSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES), categorySlug: z.string().trim().min(1).nullable().optional(), title: z.string().trim().max(80).nullable().optional() });

/** Owner cannot be changed here (use transfer); nobody edits their own role; organiser-level roles need permissions.manage. */
export async function changeMemberRole(actor: Actor, eventId: string, memberId: string, raw: unknown, executor: DbExecutor = db): Promise<void> {
  const access = await requireEventPermission(actor, eventId, "event.members.manage", executor);
  const parsed = changeRoleSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Rôle invalide.", { issues: parsed.error.issues });
  const target = await loadMember(eventId, memberId, executor);
  if (target.userId === actor.userId) throw new ForbiddenError("Vous ne pouvez pas modifier votre propre rôle.");
  if (target.role === "owner") throw new ForbiddenError("Le rôle du propriétaire ne se modifie que par transfert de propriété.");
  const elevated: EventRole[] = ["lead_organizer", "co_organizer", "wedding_planner"];
  if (elevated.includes(parsed.data.role) && !access.permissions.has("event.permissions.manage")) throw new ForbiddenError("Seul le propriétaire ou l'organisateur principal peut attribuer ce rôle.");
  let categoryId: string | null = target.categoryId;
  if (parsed.data.categorySlug !== undefined) {
    if (parsed.data.categorySlug === null) categoryId = null;
    else {
      const [cat] = await executor.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, parsed.data.categorySlug)).limit(1);
      if (!cat) throw new ValidationError("Catégorie inconnue.");
      categoryId = cat.id;
    }
  }
  await executor.update(eventMembers).set({ role: parsed.data.role, categoryId, title: parsed.data.title === undefined ? target.title : parsed.data.title }).where(eq(eventMembers.id, memberId));
  await recordAudit({ actorUserId: actor.userId, action: "event.member.role_changed", resourceType: "event_member", resourceId: memberId, eventId, metadata: { from: target.role, to: parsed.data.role } }, executor);
  await notify(
    { userId: target.userId, type: "permission_changed", title: "Votre rôle dans l'évènement a changé", body: `Nouveau rôle : ${EVENT_ROLE_LABELS[parsed.data.role]}.`, href: `/app/evenements/${eventId}`, eventId, dedupeKey: `role:${memberId}:${parsed.data.role}` },
    executor,
  );
}

export async function revokeMember(actor: Actor, eventId: string, memberId: string, reason?: string | null, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.members.manage", executor);
  const target = await loadMember(eventId, memberId, executor);
  if (target.role === "owner") throw new ForbiddenError("Le propriétaire ne peut pas être révoqué.");
  if (target.userId === actor.userId) throw new ForbiddenError("Utilisez « Quitter l'évènement » pour vous retirer.");
  if (target.status !== "active") throw new ConflictError("Ce membre n'est plus actif.");
  await executor.update(eventMembers).set({ status: "revoked", revokedAt: new Date() }).where(eq(eventMembers.id, memberId));
  await executor.update(eventProfessionals).set({ memberId: null }).where(and(eq(eventProfessionals.eventId, eventId), eq(eventProfessionals.memberId, memberId)));
  await executor.delete(channelMembers).where(eq(channelMembers.memberId, memberId));
  await recordAudit({ actorUserId: actor.userId, action: "event.member.revoked", resourceType: "event_member", resourceId: memberId, eventId, metadata: { role: target.role }, reason: reason ?? null }, executor);
  await notify({ userId: target.userId, type: "permission_changed", title: "Votre accès à un évènement a été retiré", href: "/app/evenements", eventId, dedupeKey: `revoked:${memberId}`, email: "always" }, executor);
}

export async function leaveEvent(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<void> {
  const access = await requireEventMember(actor, eventId, executor);
  if (access.role === "owner") throw new ForbiddenError("Transférez d'abord la propriété de l'évènement.");
  await executor.update(eventMembers).set({ status: "left", revokedAt: new Date() }).where(eq(eventMembers.id, access.memberId));
  await executor.update(eventProfessionals).set({ memberId: null }).where(and(eq(eventProfessionals.eventId, eventId), eq(eventProfessionals.memberId, access.memberId)));
  await executor.delete(channelMembers).where(eq(channelMembers.memberId, access.memberId));
  await recordAudit({ actorUserId: actor.userId, action: "event.member.left", resourceType: "event_member", resourceId: access.memberId, eventId }, executor);
}

export async function transferOwnership(actor: Actor, eventId: string, targetMemberId: string, executor: DbExecutor = db): Promise<void> {
  const access = await requireEventMember(actor, eventId, executor);
  if (access.role !== "owner") throw new ForbiddenError("Seul le propriétaire peut transférer l'évènement.");
  const target = await loadMember(eventId, targetMemberId, executor);
  if (target.status !== "active" || target.userId === actor.userId) throw new ValidationError("Choisissez un autre membre actif.");
  const run = async (tx: DbExecutor) => {
    await tx.update(eventMembers).set({ role: "lead_organizer" }).where(eq(eventMembers.id, access.memberId));
    await tx.update(eventMembers).set({ role: "owner", categoryId: null }).where(eq(eventMembers.id, targetMemberId));
    await tx.update(events).set({ ownerUserId: target.userId }).where(eq(events.id, eventId));
    await recordAudit({ actorUserId: actor.userId, action: "event.ownership_transferred", resourceType: "event", resourceId: eventId, eventId, metadata: { toUserId: target.userId } }, tx);
    await notify({ userId: target.userId, type: "permission_changed", title: "Vous êtes désormais propriétaire d'un évènement", href: `/app/evenements/${eventId}`, eventId, email: "always" }, tx);
  };
  return executor === db ? db.transaction((tx) => run(tx)) : run(executor);
}

// ── Explicit permissions ────────────────────────────────────────────────────
export const setPermissionSchema = z.object({
  permission: z.enum(EVENT_PERMISSIONS),
  effect: z.enum(["allow", "deny"]),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  reason: z.string().trim().max(300).nullable().optional(),
});

export async function setMemberPermission(actor: Actor, eventId: string, memberId: string, raw: unknown, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.permissions.manage", executor);
  const parsed = setPermissionSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Permission invalide.", { issues: parsed.error.issues });
  const target = await loadMember(eventId, memberId, executor);
  if (target.userId === actor.userId) throw new ForbiddenError("Vous ne pouvez pas modifier vos propres permissions.");
  if (target.role === "owner") throw new ForbiddenError("Les permissions du propriétaire ne se modifient pas.");
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  if (expiresAt && expiresAt < new Date()) throw new ValidationError("La date d'expiration est déjà passée.");
  await executor
    .insert(eventPermissions)
    .values({ eventId, memberId, permission: parsed.data.permission, effect: parsed.data.effect, grantedByUserId: actor.userId, expiresAt })
    .onConflictDoUpdate({ target: [eventPermissions.memberId, eventPermissions.permission], set: { effect: parsed.data.effect, grantedByUserId: actor.userId, expiresAt } });
  await recordAudit(
    { actorUserId: actor.userId, action: "event.permission.set", resourceType: "event_member", resourceId: memberId, eventId, metadata: { permission: parsed.data.permission, effect: parsed.data.effect, expiresAt: expiresAt?.toISOString() ?? null }, reason: parsed.data.reason ?? null },
    executor,
  );
  await notify(
    {
      userId: target.userId,
      type: "permission_changed",
      title: "Vos permissions ont été mises à jour",
      body: `${parsed.data.effect === "allow" ? "Accordé" : "Retiré"} : ${permissionLabel(parsed.data.permission)}.`,
      href: `/app/evenements/${eventId}`,
      eventId,
      dedupeKey: `perm:${memberId}:${parsed.data.permission}:${parsed.data.effect}`,
    },
    executor,
  );
}

export async function removeMemberPermission(actor: Actor, eventId: string, memberId: string, permission: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.permissions.manage", executor);
  const target = await loadMember(eventId, memberId, executor);
  if (target.userId === actor.userId) throw new ForbiddenError("Vous ne pouvez pas modifier vos propres permissions.");
  await executor.delete(eventPermissions).where(and(eq(eventPermissions.memberId, memberId), eq(eventPermissions.permission, permission), eq(eventPermissions.eventId, eventId)));
  await recordAudit({ actorUserId: actor.userId, action: "event.permission.removed", resourceType: "event_member", resourceId: memberId, eventId, metadata: { permission } }, executor);
  await notify({ userId: target.userId, type: "permission_changed", title: "Vos permissions ont été mises à jour", body: `Règle explicite retirée : ${permissionLabel(permission)}.`, href: `/app/evenements/${eventId}`, eventId, dedupeKey: `perm-rm:${memberId}:${permission}` }, executor);
}

/** What the role (and trade) gives by default — to display next to the toggles. */
export function roleDefaultPermissions(role: EventRole, categorySlug: string | null): Set<EventPermission> {
  const set = new Set<EventPermission>(EVENT_ROLE_PERMISSIONS[role]);
  if (categorySlug && (role === "provider" || role === "staff")) for (const p of TRADE_PERMISSIONS[categorySlug] ?? []) set.add(p);
  return set;
}

// ── Audit journal ───────────────────────────────────────────────────────────
export async function listEventAuditLogs(actor: Actor, eventId: string, limit = 100, executor: DbExecutor = db) {
  const access = await requireEventPermission(actor, eventId, "event.members.view", executor);
  if (!access.isOrganizer) throw new ForbiddenError();
  return executor
    .select({ id: auditLogs.id, action: auditLogs.action, resourceType: auditLogs.resourceType, resourceId: auditLogs.resourceId, metadata: auditLogs.metadata, reason: auditLogs.reason, createdAt: auditLogs.createdAt, actorName: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(eq(auditLogs.eventId, eventId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function activeMembersWithChannels(eventId: string, executor: DbExecutor = db) {
  const members = await executor
    .select({ id: eventMembers.id, userId: eventMembers.userId, name: users.name, role: eventMembers.role })
    .from(eventMembers)
    .innerJoin(users, eq(users.id, eventMembers.userId))
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, "active")))
    .orderBy(asc(users.name));
  const channels = await executor.select({ id: eventChannels.id, name: eventChannels.name }).from(eventChannels).where(and(eq(eventChannels.eventId, eventId), inArray(eventChannels.kind, ["general", "topic", "coordination"])));
  return { members, channels };
}
