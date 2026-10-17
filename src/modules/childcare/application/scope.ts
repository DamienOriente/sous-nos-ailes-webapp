import { and, eq, inArray } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { childCareAssignments, eventChildren } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { isChildScopeAssignmentOnly, requireEventPermission, type EventAccess, type EventPermission } from "@/modules/authorization";

/**
 * Resolves the actor's access to an event's children for a given permission:
 * organisers see everything (`assignedChildIds === null`), childcare staff
 * only the children assigned to their member row.
 */
export type ChildScope = { access: EventAccess; assignedChildIds: ReadonlySet<string> | null };

export async function getChildScope(actor: Actor, eventId: string, permission: EventPermission, executor: DbExecutor = db): Promise<ChildScope> {
  const access = await requireEventPermission(actor, eventId, permission, executor);
  if (!isChildScopeAssignmentOnly(access, permission) && access.isOrganizer) return { access, assignedChildIds: null };
  // Non-organisers (providers/staff, even for the roster) are always limited to their assignments.
  const rows = await executor
    .select({ childId: childCareAssignments.childId })
    .from(childCareAssignments)
    .where(and(eq(childCareAssignments.eventId, eventId), eq(childCareAssignments.memberId, access.memberId)));
  return { access, assignedChildIds: new Set(rows.map((r) => r.childId)) };
}

export function isChildInScope(scope: ChildScope, childId: string): boolean {
  return scope.assignedChildIds === null || scope.assignedChildIds.has(childId);
}

/** Loads a child of the event that the scope may see; NotFound otherwise (anti-enumeration). */
export async function requireScopedChild(scope: ChildScope, eventId: string, childId: string, executor: DbExecutor = db) {
  if (!isChildInScope(scope, childId)) throw new NotFoundError();
  const [child] = await executor
    .select()
    .from(eventChildren)
    .where(and(eq(eventChildren.id, childId), eq(eventChildren.eventId, eventId)))
    .limit(1);
  if (!child) throw new NotFoundError();
  return child;
}

export async function listScopedChildIds(scope: ChildScope, eventId: string, executor: DbExecutor = db): Promise<string[]> {
  if (scope.assignedChildIds === null) {
    const rows = await executor.select({ id: eventChildren.id }).from(eventChildren).where(eq(eventChildren.eventId, eventId));
    return rows.map((r) => r.id);
  }
  const ids = [...scope.assignedChildIds];
  if (!ids.length) return [];
  const rows = await executor
    .select({ id: eventChildren.id })
    .from(eventChildren)
    .where(and(eq(eventChildren.eventId, eventId), inArray(eventChildren.id, ids)));
  return rows.map((r) => r.id);
}
