import { and, eq } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventMembers, eventPermissions, events, professionalCategories, professionals, organizationMembers } from "@/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import {
  CHILD_ASSIGNMENT_SCOPED,
  hasGlobalPermission,
  ORGANIZER_ROLES,
  resolveEventPermissions,
  type EventPermission,
  type EventRole,
  type GlobalPermission,
} from "@/modules/authorization/domain/permissions";

/**
 * Authorisation service — deny by default, evaluated server side for every
 * resource access. Private resources that the actor cannot see raise NotFound
 * (same message as a missing id) so identifiers cannot be enumerated.
 */
export type EventAccess = {
  eventId: string;
  memberId: string;
  role: EventRole;
  categorySlug: string | null;
  professionalId: string | null;
  permissions: ReadonlySet<EventPermission>;
  isOrganizer: boolean;
  /** Whether child-level permissions are limited to assigned children. */
  childScopeIsAssignmentOnly: boolean;
};

export async function getEventAccess(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<EventAccess | null> {
  const rows = await executor
    .select({
      memberId: eventMembers.id,
      role: eventMembers.role,
      status: eventMembers.status,
      professionalId: eventMembers.professionalId,
      categorySlug: professionalCategories.slug,
      eventDeletedAt: events.deletedAt,
    })
    .from(eventMembers)
    .innerJoin(events, eq(events.id, eventMembers.eventId))
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventMembers.categoryId))
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, actor.userId)))
    .limit(1);
  const row = rows[0];
  if (!row || row.status !== "active" || row.eventDeletedAt) return null;

  const overrides = await executor
    .select({ permission: eventPermissions.permission, effect: eventPermissions.effect, expiresAt: eventPermissions.expiresAt })
    .from(eventPermissions)
    .where(eq(eventPermissions.memberId, row.memberId));

  const permissions = resolveEventPermissions({ role: row.role, categorySlug: row.categorySlug, overrides });
  const isOrganizer = ORGANIZER_ROLES.has(row.role);
  return {
    eventId,
    memberId: row.memberId,
    role: row.role,
    categorySlug: row.categorySlug,
    professionalId: row.professionalId,
    permissions,
    isOrganizer,
    childScopeIsAssignmentOnly: !isOrganizer,
  };
}

export function can(access: EventAccess | null, permission: EventPermission): boolean {
  return Boolean(access?.permissions.has(permission));
}

/** Throws NotFound when the actor is not a member, Forbidden when a member lacks the permission. */
export async function requireEventPermission(actor: Actor, eventId: string, permission: EventPermission, executor: DbExecutor = db): Promise<EventAccess> {
  const access = await getEventAccess(actor, eventId, executor);
  if (!access) throw new NotFoundError();
  if (!access.permissions.has(permission)) throw new ForbiddenError();
  return access;
}

export async function requireEventMember(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<EventAccess> {
  const access = await getEventAccess(actor, eventId, executor);
  if (!access) throw new NotFoundError();
  return access;
}

export function isChildScopeAssignmentOnly(access: EventAccess, permission: EventPermission): boolean {
  return access.childScopeIsAssignmentOnly && CHILD_ASSIGNMENT_SCOPED.has(permission);
}

// ── Professional listings ───────────────────────────────────────────────────
export type ProfessionalAccess = { professionalId: string; ownerUserId: string; organizationId: string | null; role: "owner" | "org_admin" | "org_manager" | "org_member" };

/** Who can manage a listing: its owner, or admins/managers of its organisation. */
export async function getProfessionalAccess(actor: Actor, professionalId: string, executor: DbExecutor = db): Promise<ProfessionalAccess | null> {
  const [pro] = await executor
    .select({ id: professionals.id, ownerUserId: professionals.ownerUserId, organizationId: professionals.organizationId, deletedAt: professionals.deletedAt })
    .from(professionals)
    .where(eq(professionals.id, professionalId))
    .limit(1);
  if (!pro || pro.deletedAt) return null;
  if (pro.ownerUserId === actor.userId) return { professionalId, ownerUserId: pro.ownerUserId, organizationId: pro.organizationId, role: "owner" };
  if (pro.organizationId) {
    const [m] = await executor
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, pro.organizationId), eq(organizationMembers.userId, actor.userId)))
      .limit(1);
    if (m) {
      const role = m.role === "owner" || m.role === "admin" ? "org_admin" : m.role === "manager" ? "org_manager" : "org_member";
      return { professionalId, ownerUserId: pro.ownerUserId, organizationId: pro.organizationId, role };
    }
  }
  return null;
}

export async function requireProfessionalManage(actor: Actor, professionalId: string, executor: DbExecutor = db): Promise<ProfessionalAccess> {
  const access = await getProfessionalAccess(actor, professionalId, executor);
  if (!access) throw new NotFoundError();
  if (access.role === "org_member") throw new ForbiddenError();
  return access;
}

// ── Platform roles ──────────────────────────────────────────────────────────
export function requireGlobalPermission(actor: Actor, permission: GlobalPermission): void {
  if (!hasGlobalPermission(actor.globalRole, permission)) throw new ForbiddenError();
}

export function canGlobal(actor: Actor | null, permission: GlobalPermission): boolean {
  return actor ? hasGlobalPermission(actor.globalRole, permission) : false;
}
