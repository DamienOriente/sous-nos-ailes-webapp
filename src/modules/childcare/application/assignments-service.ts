import { and, eq } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { auditLogs, childCareAssignments, eventChildren, eventMembers, professionalCategories, users } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";

export type CareTeamMember = {
  memberId: string;
  userId: string;
  name: string;
  role: string;
  categorySlug: string | null;
  categoryName: string | null;
  isChildcare: boolean;
  assignedChildIds: string[];
};

/** Members eligible for child assignments: active providers/staff. Childcare trades are flagged; others need the organiser to insist. */
export async function listCareTeam(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<CareTeamMember[]> {
  await requireEventPermission(actor, eventId, "children.view_roster", executor);
  const members = await executor
    .select({
      memberId: eventMembers.id,
      userId: eventMembers.userId,
      name: users.name,
      role: eventMembers.role,
      categorySlug: professionalCategories.slug,
      categoryName: professionalCategories.name,
      isChildcare: professionalCategories.isChildcare,
    })
    .from(eventMembers)
    .innerJoin(users, eq(users.id, eventMembers.userId))
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventMembers.categoryId))
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, "active")));
  const eligible = members.filter((m) => m.role === "provider" || m.role === "staff");
  const assignments = await executor
    .select({ memberId: childCareAssignments.memberId, childId: childCareAssignments.childId })
    .from(childCareAssignments)
    .where(eq(childCareAssignments.eventId, eventId));
  return eligible
    .map((m) => ({
      ...m,
      isChildcare: m.isChildcare ?? false,
      assignedChildIds: assignments.filter((a) => a.memberId === m.memberId).map((a) => a.childId),
    }))
    .sort((a, b) => Number(b.isChildcare) - Number(a.isChildcare) || a.name.localeCompare(b.name));
}

export async function assignChild(actor: Actor, eventId: string, childId: string, memberId: string, opts: { allowNonChildcare?: boolean } = {}, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "children.assign_staff", executor);
  const [child] = await executor.select({ id: eventChildren.id }).from(eventChildren).where(and(eq(eventChildren.id, childId), eq(eventChildren.eventId, eventId))).limit(1);
  if (!child) throw new NotFoundError();
  const [member] = await executor
    .select({ id: eventMembers.id, role: eventMembers.role, status: eventMembers.status, isChildcare: professionalCategories.isChildcare })
    .from(eventMembers)
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventMembers.categoryId))
    .where(and(eq(eventMembers.id, memberId), eq(eventMembers.eventId, eventId)))
    .limit(1);
  if (!member || member.status !== "active") throw new NotFoundError();
  if (member.role !== "provider" && member.role !== "staff") throw new ValidationError("Seuls les prestataires et le personnel opérationnel peuvent être affectés à des enfants.");
  if (!member.isChildcare && !opts.allowNonChildcare) throw new ValidationError("Ce membre n'exerce pas un métier de garde d'enfants. Confirmez explicitement l'affectation.");
  await executor.insert(childCareAssignments).values({ eventId, childId, memberId, assignedByUserId: actor.userId }).onConflictDoNothing();
  await executor.insert(auditLogs).values({ actorUserId: actor.userId, action: "children.assigned", resourceType: "event_child", resourceId: childId, eventId, metadata: { memberId } });
}

export async function unassignChild(actor: Actor, eventId: string, childId: string, memberId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "children.assign_staff", executor);
  await executor.delete(childCareAssignments).where(and(eq(childCareAssignments.eventId, eventId), eq(childCareAssignments.childId, childId), eq(childCareAssignments.memberId, memberId)));
  await executor.insert(auditLogs).values({ actorUserId: actor.userId, action: "children.unassigned", resourceType: "event_child", resourceId: childId, eventId, metadata: { memberId } });
}
