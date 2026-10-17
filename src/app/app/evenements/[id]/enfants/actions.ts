"use server";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { parseLocalDateTime } from "@/modules/calendar/domain/datetime";
import { assignChild, unassignChild } from "@/modules/childcare/application/assignments-service";
import { activitySchema, createActivity, deleteActivity } from "@/modules/childcare/application/activities-service";
import { attendanceSchema, handoverSchema, performHandover, recordAttendance } from "@/modules/childcare/application/attendance-service";
import {
  addAuthorizedPerson,
  addEmergencyContact,
  authorizedPersonSchema,
  childInputSchema,
  createChild,
  deleteChild,
  emergencyContactSchema,
  markGuardianInformed,
  readSensitiveInformation,
  removeAuthorizedPerson,
  removeEmergencyContact,
  sensitiveInputSchema,
  setSensitiveInformation,
  updateChild,
  withdrawSensitiveConsent,
  type SensitiveReadResult,
} from "@/modules/childcare/application/children-service";

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}

function invalid(error: z.ZodError): ActionResult<never> {
  return { ok: false, error: error.issues[0]?.message ?? new ValidationError().message, code: "validation", fieldErrors: fieldErrors(error) };
}

function base(eventId: string) {
  return `/app/evenements/${eventId}/enfants`;
}

async function childFormToInput(fd: FormData, userId: string) {
  const tz = await getUserTimezone(userId);
  const raw = Object.fromEntries(fd.entries());
  return childInputSchema.safeParse({
    ...raw,
    expectedArrivalAt: parseLocalDateTime(String(raw.expectedArrivalAt ?? ""), tz)?.toISOString() ?? "",
    expectedDepartureAt: parseLocalDateTime(String(raw.expectedDepartureAt ?? ""), tz)?.toISOString() ?? "",
  });
}

export async function createChildAction(eventId: string, fd: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = await childFormToInput(fd, actor.userId);
    if (!parsed.success) return invalid(parsed.error);
    const res = await createChild(actor, eventId, parsed.data);
    revalidatePath(base(eventId));
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateChildAction(eventId: string, childId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = await childFormToInput(fd, actor.userId);
    if (!parsed.success) return invalid(parsed.error);
    await updateChild(actor, eventId, childId, parsed.data);
    revalidatePath(`${base(eventId)}/${childId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteChildAction(eventId: string, childId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteChild(actor, eventId, childId);
    revalidatePath(base(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function markGuardianInformedAction(eventId: string, childId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await markGuardianInformed(actor, eventId, childId);
    revalidatePath(`${base(eventId)}/${childId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addEmergencyContactAction(eventId: string, childId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = emergencyContactSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) return invalid(parsed.error);
    await addEmergencyContact(actor, eventId, childId, parsed.data);
    revalidatePath(`${base(eventId)}/${childId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function removeEmergencyContactAction(eventId: string, childId: string, contactId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await removeEmergencyContact(actor, eventId, childId, contactId);
    revalidatePath(`${base(eventId)}/${childId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addAuthorizedPersonAction(eventId: string, childId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const raw = Object.fromEntries(fd.entries());
    const parsed = authorizedPersonSchema.safeParse({ ...raw, isPrimaryGuardian: raw.isPrimaryGuardian === "on" || raw.isPrimaryGuardian === "true" });
    if (!parsed.success) return invalid(parsed.error);
    await addAuthorizedPerson(actor, eventId, childId, parsed.data);
    revalidatePath(`${base(eventId)}/${childId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function removeAuthorizedPersonAction(eventId: string, childId: string, personId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await removeAuthorizedPerson(actor, eventId, childId, personId);
    revalidatePath(`${base(eventId)}/${childId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setSensitiveAction(eventId: string, childId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const raw = Object.fromEntries(fd.entries());
    const parsed = sensitiveInputSchema.safeParse({ ...raw, consentConfirmed: raw.consentConfirmed === "on" || raw.consentConfirmed === "true" ? true : false });
    if (!parsed.success) return invalid(parsed.error);
    await setSensitiveInformation(actor, eventId, childId, parsed.data);
    revalidatePath(`${base(eventId)}/${childId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function withdrawConsentAction(eventId: string, childId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await withdrawSensitiveConsent(actor, eventId, childId);
    revalidatePath(`${base(eventId)}/${childId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

/** Decrypts and returns health data for display only — never persisted client side beyond the view. */
export async function readSensitiveAction(eventId: string, childId: string, fd: FormData): Promise<ActionResult<SensitiveReadResult>> {
  try {
    const actor = await requireActorOrThrow();
    const purpose = String(fd.get("purpose") ?? "").trim();
    const data = await readSensitiveInformation(actor, eventId, childId, purpose);
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}

export async function recordAttendanceAction(eventId: string, childId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = attendanceSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) return invalid(parsed.error);
    await recordAttendance(actor, eventId, childId, parsed.data);
    revalidatePath(base(eventId));
    revalidatePath(`${base(eventId)}/${childId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function quickAttendanceAction(eventId: string, childId: string, kind: "check_in" | "check_out"): Promise<ActionResult> {
  const fd = new FormData();
  fd.set("kind", kind);
  return recordAttendanceAction(eventId, childId, fd);
}

export async function handoverAction(eventId: string, childId: string, fd: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = handoverSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) return invalid(parsed.error);
    const res = await performHandover(actor, eventId, childId, parsed.data);
    revalidatePath(base(eventId));
    revalidatePath(`${base(eventId)}/${childId}`);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

export async function assignChildAction(eventId: string, childId: string, memberId: string, allowNonChildcare = false): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await assignChild(actor, eventId, childId, memberId, { allowNonChildcare });
    revalidatePath(`${base(eventId)}/equipe`);
    revalidatePath(base(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function unassignChildAction(eventId: string, childId: string, memberId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await unassignChild(actor, eventId, childId, memberId);
    revalidatePath(`${base(eventId)}/equipe`);
    revalidatePath(base(eventId));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createActivityAction(eventId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const tz = await getUserTimezone(actor.userId);
    const raw = Object.fromEntries(fd.entries());
    const parsed = activitySchema.safeParse({
      ...raw,
      startsAt: parseLocalDateTime(String(raw.startsAt ?? ""), tz) ?? "",
      endsAt: parseLocalDateTime(String(raw.endsAt ?? ""), tz),
      minAge: raw.minAge ? raw.minAge : null,
      maxAge: raw.maxAge ? raw.maxAge : null,
    });
    if (!parsed.success) return invalid(parsed.error);
    await createActivity(actor, eventId, parsed.data);
    revalidatePath(`${base(eventId)}/activites`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteActivityAction(eventId: string, activityId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteActivity(actor, eventId, activityId);
    revalidatePath(`${base(eventId)}/activites`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
