import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import {
  auditLogs,
  childAccessLogs,
  childAttendance,
  childAuthorizedPersons,
  childCareAssignments,
  childEmergencyContacts,
  childSensitiveInformation,
  consentRecords,
  eventChildren,
  eventMembers,
  users,
} from "@/db/schema";
import { decryptText, encryptText } from "@/lib/crypto";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { computePresence, decideSensitiveRead, hasActiveConsent, type PresenceStatus } from "@/modules/childcare/domain/rules";
import { getChildScope, requireScopedChild, type ChildScope } from "./scope";

// ── Schemas ─────────────────────────────────────────────────────────────────
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));
const optionalDate = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Date invalide");

export const childInputSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(80),
  lastName: z.string().trim().max(80).default(""),
  ageYears: z.coerce.number().int().min(0).max(17),
  guardianName: z.string().trim().min(1, "Responsable requis").max(120),
  guardianPhone: z.string().trim().min(6, "Téléphone requis").max(30),
  guardianEmail: z.email().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  careInstructions: optionalText(2000),
  dietaryPreference: optionalText(80),
  expectedArrivalAt: optionalDate,
  expectedDepartureAt: optionalDate,
});
export type ChildInput = z.infer<typeof childInputSchema>;

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(60),
  phone: z.string().trim().min(6).max(30),
  priority: z.coerce.number().int().min(1).max(9).default(1),
});

export const authorizedPersonSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(60),
  phone: optionalText(30),
  identityCheckHint: optionalText(200),
  isPrimaryGuardian: z.coerce.boolean().default(false),
});

export const sensitiveInputSchema = z.object({
  allergies: optionalText(4000),
  healthNotes: optionalText(4000),
  consentGivenByName: z.string().trim().min(2, "Nom du responsable légal requis").max(120),
  consentConfirmed: z.literal(true, { error: "Le consentement explicite du responsable légal est obligatoire." }),
});

// ── Roster ──────────────────────────────────────────────────────────────────
export type RosterChild = {
  id: string;
  firstName: string;
  lastName: string;
  ageYears: number;
  guardianName: string;
  guardianPhone: string;
  dietaryPreference: string | null;
  careInstructions: string | null;
  expectedArrivalAt: Date | null;
  expectedDepartureAt: Date | null;
  guardianInformedAt: Date | null;
  anonymizedAt: Date | null;
  hasAllergies: boolean;
  hasHealthNotes: boolean;
  consentActive: boolean;
  presence: PresenceStatus;
  assignees: { memberId: string; name: string }[];
};

/**
 * Roster visible to the actor. Sensitive text never leaves this function —
 * only the boolean flags telling the care team that something must be read.
 */
export async function listChildren(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<{ scope: ChildScope; children: RosterChild[] }> {
  const scope = await getChildScope(actor, eventId, "children.view_roster", executor);
  const base = executor
    .select({
      child: eventChildren,
      hasAllergies: childSensitiveInformation.hasAllergies,
      hasHealthNotes: childSensitiveInformation.hasHealthNotes,
      consentGivenAt: childSensitiveInformation.consentGivenAt,
      consentWithdrawnAt: childSensitiveInformation.consentWithdrawnAt,
    })
    .from(eventChildren)
    .leftJoin(childSensitiveInformation, eq(childSensitiveInformation.childId, eventChildren.id))
    .orderBy(asc(eventChildren.lastName), asc(eventChildren.firstName));
  const rows =
    scope.assignedChildIds === null
      ? await base.where(eq(eventChildren.eventId, eventId))
      : scope.assignedChildIds.size
        ? await base.where(and(eq(eventChildren.eventId, eventId), inArray(eventChildren.id, [...scope.assignedChildIds])))
        : [];
  const ids = rows.map((r) => r.child.id);
  const attendance = ids.length
    ? await executor
        .select({ childId: childAttendance.childId, kind: childAttendance.kind, recordedAt: childAttendance.recordedAt })
        .from(childAttendance)
        .where(inArray(childAttendance.childId, ids))
    : [];
  const presence = computePresence(ids, attendance);
  const assignments = ids.length
    ? await executor
        .select({ childId: childCareAssignments.childId, memberId: childCareAssignments.memberId, name: users.name })
        .from(childCareAssignments)
        .innerJoin(eventMembers, eq(eventMembers.id, childCareAssignments.memberId))
        .innerJoin(users, eq(users.id, eventMembers.userId))
        .where(inArray(childCareAssignments.childId, ids))
    : [];
  const children: RosterChild[] = rows.map((r) => ({
    id: r.child.id,
    firstName: r.child.firstName,
    lastName: r.child.lastName,
    ageYears: r.child.ageYears,
    guardianName: r.child.guardianName,
    guardianPhone: r.child.guardianPhone,
    dietaryPreference: r.child.dietaryPreference,
    careInstructions: r.child.careInstructions,
    expectedArrivalAt: r.child.expectedArrivalAt,
    expectedDepartureAt: r.child.expectedDepartureAt,
    guardianInformedAt: r.child.guardianInformedAt,
    anonymizedAt: r.child.anonymizedAt,
    hasAllergies: r.hasAllergies ?? false,
    hasHealthNotes: r.hasHealthNotes ?? false,
    consentActive: hasActiveConsent({ consentGivenAt: r.consentGivenAt ?? null, consentWithdrawnAt: r.consentWithdrawnAt ?? null }),
    presence: presence.get(r.child.id) ?? "expected",
    assignees: assignments.filter((a) => a.childId === r.child.id).map((a) => ({ memberId: a.memberId, name: a.name })),
  }));
  return { scope, children };
}

// ── Child detail ────────────────────────────────────────────────────────────
export async function getChildDetail(actor: Actor, eventId: string, childId: string, executor: DbExecutor = db) {
  const scope = await getChildScope(actor, eventId, "children.view_roster", executor);
  const child = await requireScopedChild(scope, eventId, childId, executor);
  const [sensitive] = await executor
    .select({
      hasAllergies: childSensitiveInformation.hasAllergies,
      hasHealthNotes: childSensitiveInformation.hasHealthNotes,
      consentGivenByName: childSensitiveInformation.consentGivenByName,
      consentGivenAt: childSensitiveInformation.consentGivenAt,
      consentWithdrawnAt: childSensitiveInformation.consentWithdrawnAt,
    })
    .from(childSensitiveInformation)
    .where(eq(childSensitiveInformation.childId, childId))
    .limit(1);
  const [emergencyContacts, authorizedPersons, attendance, assignments] = await Promise.all([
    executor.select().from(childEmergencyContacts).where(eq(childEmergencyContacts.childId, childId)).orderBy(asc(childEmergencyContacts.priority)),
    executor.select().from(childAuthorizedPersons).where(eq(childAuthorizedPersons.childId, childId)).orderBy(desc(childAuthorizedPersons.isPrimaryGuardian), asc(childAuthorizedPersons.name)),
    executor
      .select({ id: childAttendance.id, kind: childAttendance.kind, recordedAt: childAttendance.recordedAt, note: childAttendance.note, recordedBy: users.name })
      .from(childAttendance)
      .innerJoin(users, eq(users.id, childAttendance.recordedByUserId))
      .where(eq(childAttendance.childId, childId))
      .orderBy(desc(childAttendance.recordedAt)),
    executor
      .select({ memberId: childCareAssignments.memberId, name: users.name })
      .from(childCareAssignments)
      .innerJoin(eventMembers, eq(eventMembers.id, childCareAssignments.memberId))
      .innerJoin(users, eq(users.id, eventMembers.userId))
      .where(eq(childCareAssignments.childId, childId)),
  ]);
  const presence = computePresence([childId], attendance.map((a) => ({ childId, kind: a.kind, recordedAt: a.recordedAt }))).get(childId) ?? "expected";
  return {
    scope,
    child,
    sensitive: sensitive
      ? { ...sensitive, consentActive: hasActiveConsent(sensitive) }
      : { hasAllergies: false, hasHealthNotes: false, consentGivenByName: null, consentGivenAt: null, consentWithdrawnAt: null, consentActive: false },
    emergencyContacts,
    authorizedPersons,
    attendance,
    assignments,
    presence,
  };
}

// ── CRUD (organisers with children.manage) ──────────────────────────────────
export async function createChild(actor: Actor, eventId: string, input: ChildInput, executor: DbExecutor = db): Promise<{ id: string }> {
  await requireEventPermission(actor, eventId, "children.manage", executor);
  const [row] = await executor
    .insert(eventChildren)
    .values({ ...input, eventId, registeredByUserId: actor.userId })
    .returning({ id: eventChildren.id });
  if (!row) throw new Error("insert failed");
  return row;
}

export async function updateChild(actor: Actor, eventId: string, childId: string, input: ChildInput, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "children.manage", executor);
  const res = await executor
    .update(eventChildren)
    .set({ ...input })
    .where(and(eq(eventChildren.id, childId), eq(eventChildren.eventId, eventId)))
    .returning({ id: eventChildren.id });
  if (!res.length) throw new NotFoundError();
}

export async function deleteChild(actor: Actor, eventId: string, childId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "children.manage", executor);
  const res = await executor
    .delete(eventChildren)
    .where(and(eq(eventChildren.id, childId), eq(eventChildren.eventId, eventId)))
    .returning({ id: eventChildren.id });
  if (!res.length) throw new NotFoundError();
  await executor.insert(auditLogs).values({ actorUserId: actor.userId, action: "children.child_deleted", resourceType: "event_child", resourceId: childId, eventId });
}

export async function markGuardianInformed(actor: Actor, eventId: string, childId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "children.manage", executor);
  const res = await executor
    .update(eventChildren)
    .set({ guardianInformedAt: new Date() })
    .where(and(eq(eventChildren.id, childId), eq(eventChildren.eventId, eventId)))
    .returning({ id: eventChildren.id });
  if (!res.length) throw new NotFoundError();
}

async function requireManagedChild(actor: Actor, eventId: string, childId: string, executor: DbExecutor) {
  await requireEventPermission(actor, eventId, "children.manage", executor);
  const [child] = await executor
    .select({ id: eventChildren.id })
    .from(eventChildren)
    .where(and(eq(eventChildren.id, childId), eq(eventChildren.eventId, eventId)))
    .limit(1);
  if (!child) throw new NotFoundError();
}

export async function addEmergencyContact(actor: Actor, eventId: string, childId: string, input: z.infer<typeof emergencyContactSchema>, executor: DbExecutor = db) {
  await requireManagedChild(actor, eventId, childId, executor);
  await executor.insert(childEmergencyContacts).values({ ...input, childId });
}

export async function removeEmergencyContact(actor: Actor, eventId: string, childId: string, contactId: string, executor: DbExecutor = db) {
  await requireManagedChild(actor, eventId, childId, executor);
  await executor.delete(childEmergencyContacts).where(and(eq(childEmergencyContacts.id, contactId), eq(childEmergencyContacts.childId, childId)));
}

export async function addAuthorizedPerson(actor: Actor, eventId: string, childId: string, input: z.infer<typeof authorizedPersonSchema>, executor: DbExecutor = db) {
  await requireManagedChild(actor, eventId, childId, executor);
  await executor.insert(childAuthorizedPersons).values({ ...input, childId });
}

export async function removeAuthorizedPerson(actor: Actor, eventId: string, childId: string, personId: string, executor: DbExecutor = db) {
  await requireManagedChild(actor, eventId, childId, executor);
  await executor.delete(childAuthorizedPersons).where(and(eq(childAuthorizedPersons.id, personId), eq(childAuthorizedPersons.childId, childId)));
}

// ── Sensitive information ───────────────────────────────────────────────────
/**
 * Records (or replaces) health data. Requires an explicit consent checkbox on
 * behalf of the legal guardian; the consent is also logged in consent_records
 * (purpose child_health_data) and the write in child_access_logs.
 */
export async function setSensitiveInformation(actor: Actor, eventId: string, childId: string, input: z.infer<typeof sensitiveInputSchema>, executor: DbExecutor = db): Promise<void> {
  await requireManagedChild(actor, eventId, childId, executor);
  if (!input.allergies && !input.healthNotes) throw new ValidationError("Renseignez au moins une information (allergies ou notes de santé).");
  const now = new Date();
  await executor
    .insert(childSensitiveInformation)
    .values({
      childId,
      allergiesEncrypted: input.allergies ? encryptText(input.allergies) : null,
      healthNotesEncrypted: input.healthNotes ? encryptText(input.healthNotes) : null,
      hasAllergies: Boolean(input.allergies),
      hasHealthNotes: Boolean(input.healthNotes),
      consentGivenByName: input.consentGivenByName,
      consentGivenAt: now,
      consentWithdrawnAt: null,
      consentRecordedByUserId: actor.userId,
    })
    .onConflictDoUpdate({
      target: childSensitiveInformation.childId,
      set: {
        allergiesEncrypted: input.allergies ? encryptText(input.allergies) : null,
        healthNotesEncrypted: input.healthNotes ? encryptText(input.healthNotes) : null,
        hasAllergies: Boolean(input.allergies),
        hasHealthNotes: Boolean(input.healthNotes),
        consentGivenByName: input.consentGivenByName,
        consentGivenAt: now,
        consentWithdrawnAt: null,
        consentRecordedByUserId: actor.userId,
      },
    });
  await executor.insert(consentRecords).values({ userId: actor.userId, purpose: "child_health_data", granted: "granted", policyVersion: "v1" });
  await executor.insert(childAccessLogs).values({ eventId, childId, userId: actor.userId, action: "edit_sensitive", purpose: "Saisie / mise à jour par l'organisateur" });
}

/** Withdraws consent and erases the encrypted payloads (data minimisation). */
export async function withdrawSensitiveConsent(actor: Actor, eventId: string, childId: string, executor: DbExecutor = db): Promise<void> {
  await requireManagedChild(actor, eventId, childId, executor);
  const res = await executor
    .update(childSensitiveInformation)
    .set({ allergiesEncrypted: null, healthNotesEncrypted: null, hasAllergies: false, hasHealthNotes: false, consentWithdrawnAt: new Date() })
    .where(eq(childSensitiveInformation.childId, childId))
    .returning({ childId: childSensitiveInformation.childId });
  if (!res.length) throw new NotFoundError();
  await executor.insert(consentRecords).values({ userId: actor.userId, purpose: "child_health_data", granted: "withdrawn", policyVersion: "v1" });
  await executor.insert(childAccessLogs).values({ eventId, childId, userId: actor.userId, action: "withdraw_consent", purpose: "Retrait du consentement" });
  await executor.insert(auditLogs).values({ actorUserId: actor.userId, action: "children.consent_withdrawn", resourceType: "event_child", resourceId: childId, eventId });
}

export type SensitiveReadResult = { allergies: string | null; healthNotes: string | null; consentGivenByName: string | null; consentGivenAt: Date | null };

/**
 * Decrypts health data for an authorised reader. Enforces permission +
 * assignment scope + active consent + purpose, and logs the read.
 * Denials for scope reasons raise NotFound (anti-enumeration), missing
 * permission/consent raise Forbidden with an explicit message.
 */
export async function readSensitiveInformation(actor: Actor, eventId: string, childId: string, purpose: string, executor: DbExecutor = db): Promise<SensitiveReadResult> {
  const scope = await getChildScope(actor, eventId, "children.view_roster", executor);
  const hasPermission = scope.access.permissions.has("children.view_sensitive");
  const isAssigned = scope.assignedChildIds === null || scope.assignedChildIds.has(childId);
  if (!isAssigned) throw new NotFoundError();
  const [child] = await executor
    .select({ id: eventChildren.id })
    .from(eventChildren)
    .where(and(eq(eventChildren.id, childId), eq(eventChildren.eventId, eventId)))
    .limit(1);
  if (!child) throw new NotFoundError();
  const [row] = await executor.select().from(childSensitiveInformation).where(eq(childSensitiveInformation.childId, childId)).limit(1);
  const decision = decideSensitiveRead({
    hasPermission,
    scopeIsAssignmentOnly: scope.assignedChildIds !== null,
    isAssigned,
    consent: row ? { consentGivenAt: row.consentGivenAt, consentWithdrawnAt: row.consentWithdrawnAt } : null,
    purpose,
  });
  if (!decision.allowed) {
    switch (decision.reason) {
      case "no_permission":
        throw new ForbiddenError("Vous n'êtes pas habilité à consulter les informations de santé.");
      case "no_consent":
        throw new ForbiddenError("Aucun consentement actif du responsable légal : ces informations ne peuvent pas être consultées.");
      case "missing_purpose":
        throw new ValidationError("Indiquez le motif de la consultation.");
      default:
        throw new NotFoundError();
    }
  }
  await executor.insert(childAccessLogs).values({ eventId, childId, userId: actor.userId, action: "view_sensitive", purpose: purpose.trim() });
  return {
    allergies: row?.allergiesEncrypted ? decryptText(row.allergiesEncrypted) : null,
    healthNotes: row?.healthNotesEncrypted ? decryptText(row.healthNotesEncrypted) : null,
    consentGivenByName: row?.consentGivenByName ?? null,
    consentGivenAt: row?.consentGivenAt ?? null,
  };
}

// ── Access logs ─────────────────────────────────────────────────────────────
export async function listAccessLogs(actor: Actor, eventId: string, executor: DbExecutor = db) {
  await requireEventPermission(actor, eventId, "children.view_access_logs", executor);
  return executor
    .select({
      id: childAccessLogs.id,
      childId: childAccessLogs.childId,
      childFirstName: eventChildren.firstName,
      childLastName: eventChildren.lastName,
      userName: users.name,
      action: childAccessLogs.action,
      purpose: childAccessLogs.purpose,
      accessedAt: childAccessLogs.accessedAt,
    })
    .from(childAccessLogs)
    .innerJoin(eventChildren, eq(eventChildren.id, childAccessLogs.childId))
    .innerJoin(users, eq(users.id, childAccessLogs.userId))
    .where(eq(childAccessLogs.eventId, eventId))
    .orderBy(desc(childAccessLogs.accessedAt))
    .limit(500);
}
