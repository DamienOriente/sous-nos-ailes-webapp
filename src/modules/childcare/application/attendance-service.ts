import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { childAttendance, childAuthorizedPersons, childHandoverRecords, users } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { computePresence, IDENTITY_CHECK_METHODS, summarizePresence, validateHandover } from "@/modules/childcare/domain/rules";
import { getChildScope, listScopedChildIds, requireScopedChild } from "./scope";

export const attendanceSchema = z.object({
  kind: z.enum(["check_in", "check_out", "incident", "note"]),
  note: z.string().trim().max(2000).optional().or(z.literal("")).transform((v) => (v ? v : null)),
});

/** Check-in / check-out / incident / note. Scoped to assigned children for staff. */
export async function recordAttendance(actor: Actor, eventId: string, childId: string, input: z.infer<typeof attendanceSchema>, executor: DbExecutor = db): Promise<void> {
  const scope = await getChildScope(actor, eventId, "children.record_attendance", executor);
  await requireScopedChild(scope, eventId, childId, executor);
  if ((input.kind === "incident" || input.kind === "note") && !input.note) throw new ValidationError("Une description est requise.");
  if (input.kind === "check_out") {
    // A check-out without handover is only allowed as a correction; the normal path is performHandover.
    const current = await presenceOf(childId, executor);
    if (current !== "present") throw new ConflictError("L'enfant n'est pas enregistré comme présent.");
  }
  if (input.kind === "check_in") {
    const current = await presenceOf(childId, executor);
    if (current === "present") throw new ConflictError("L'enfant est déjà enregistré comme présent.");
  }
  await executor.insert(childAttendance).values({ eventId, childId, kind: input.kind, note: input.note, recordedByUserId: actor.userId });
}

async function presenceOf(childId: string, executor: DbExecutor) {
  const rows = await executor
    .select({ childId: childAttendance.childId, kind: childAttendance.kind, recordedAt: childAttendance.recordedAt })
    .from(childAttendance)
    .where(eq(childAttendance.childId, childId));
  return computePresence([childId], rows).get(childId) ?? "expected";
}

export async function getPresenceDashboard(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const scope = await getChildScope(actor, eventId, "children.view_roster", executor);
  const ids = await listScopedChildIds(scope, eventId, executor);
  const rows = ids.length
    ? await executor
        .select({ childId: childAttendance.childId, kind: childAttendance.kind, recordedAt: childAttendance.recordedAt })
        .from(childAttendance)
        .where(inArray(childAttendance.childId, ids))
    : [];
  const presence = computePresence(ids, rows);
  const incidents = rows.filter((r) => r.kind === "incident").length;
  return { ...summarizePresence(presence), incidents, total: ids.length };
}

// ── Handover ────────────────────────────────────────────────────────────────
export const handoverSchema = z.object({
  authorizedPersonId: z.uuid({ error: "Choisissez une personne autorisée." }),
  identityCheckMethod: z.enum(IDENTITY_CHECK_METHODS, { error: "Indiquez comment l'identité a été vérifiée." }),
  identityCheckDetails: z.string().trim().max(300).default(""),
  note: z.string().trim().max(1000).optional().or(z.literal("")).transform((v) => (v ? v : null)),
});
export type HandoverInput = z.infer<typeof handoverSchema>;

/**
 * Three-step handover: authorised person from the list → identity check
 * declared → confirmation by the signed-in care team member. Writes the
 * handover record and the check-out in one transaction-like sequence
 * (callers may pass a transaction executor).
 */
export async function performHandover(actor: Actor, eventId: string, childId: string, input: HandoverInput, executor: DbExecutor = db): Promise<{ id: string }> {
  const scope = await getChildScope(actor, eventId, "children.handover", executor);
  const isInScope = scope.assignedChildIds === null || scope.assignedChildIds.has(childId);
  const [person] = isInScope
    ? await executor
        .select()
        .from(childAuthorizedPersons)
        .where(and(eq(childAuthorizedPersons.id, input.authorizedPersonId), eq(childAuthorizedPersons.childId, childId)))
        .limit(1)
    : [];
  const validation = validateHandover({
    authorizedPersonId: person?.id ?? null,
    identityCheckMethod: input.identityCheckMethod,
    identityCheckDetails: input.identityCheckDetails,
    confirmerHasPermission: scope.access.permissions.has("children.handover"),
    confirmerIsAssignedOrOrganizer: isInScope,
  });
  if (!validation.ok) {
    if (!isInScope) throw new NotFoundError();
    throw new ValidationError(validation.error);
  }
  await requireScopedChild(scope, eventId, childId, executor);
  const current = await presenceOf(childId, executor);
  if (current === "left") throw new ConflictError("Cet enfant a déjà été remis.");
  const [record] = await executor
    .insert(childHandoverRecords)
    .values({
      eventId,
      childId,
      authorizedPersonId: person!.id,
      receivedByName: person!.name,
      identityVerifiedHow: validation.identityVerifiedHow,
      confirmedByUserId: actor.userId,
      note: input.note,
    })
    .returning({ id: childHandoverRecords.id });
  await executor.insert(childAttendance).values({ eventId, childId, kind: "check_out", note: `Remise à ${person!.name}`, recordedByUserId: actor.userId });
  return { id: record!.id };
}

export async function listHandovers(actor: Actor, eventId: string, childId: string, executor: DbExecutor = db) {
  const scope = await getChildScope(actor, eventId, "children.view_roster", executor);
  await requireScopedChild(scope, eventId, childId, executor);
  return executor
    .select({
      id: childHandoverRecords.id,
      receivedByName: childHandoverRecords.receivedByName,
      identityVerifiedHow: childHandoverRecords.identityVerifiedHow,
      handedOverAt: childHandoverRecords.handedOverAt,
      note: childHandoverRecords.note,
      confirmedBy: users.name,
    })
    .from(childHandoverRecords)
    .innerJoin(users, eq(users.id, childHandoverRecords.confirmedByUserId))
    .where(eq(childHandoverRecords.childId, childId))
    .orderBy(desc(childHandoverRecords.handedOverAt));
}

/** Children currently present with their authorised persons, for the handover screen. */
export async function listAuthorizedPersonsForHandover(actor: Actor, eventId: string, childId: string, executor: DbExecutor = db) {
  const scope = await getChildScope(actor, eventId, "children.handover", executor);
  const child = await requireScopedChild(scope, eventId, childId, executor);
  const persons = await executor.select().from(childAuthorizedPersons).where(eq(childAuthorizedPersons.childId, childId)).orderBy(desc(childAuthorizedPersons.isPrimaryGuardian));
  const presence = await presenceOf(childId, executor);
  return { child: { id: child.id, firstName: child.firstName, lastName: child.lastName, ageYears: child.ageYears }, persons, presence };
}
