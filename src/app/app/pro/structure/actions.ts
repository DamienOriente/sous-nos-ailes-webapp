"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/professionals/action-form";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { formToObject, toActionErrorWithFields, validationResult } from "@/modules/professionals/application/form-parsing";
import { requestAgencyStatus, setPrimaryListing } from "@/modules/professionals/application/agency-service";
import { changeMemberRole, inviteMember, removeMember, revokeOrganizationInvitation } from "@/modules/professionals/application/member-service";
import { agencyRequestSchema } from "@/modules/professionals/domain/agency-schema";
import { changeMemberRoleSchema, inviteMemberSchema } from "@/modules/professionals/domain/members";

export async function requestAgencyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const parsed = agencyRequestSchema.safeParse(formToObject(form));
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await requestAgencyStatus(actor, parsed.data);
  } catch (e) {
    return toActionErrorWithFields(e);
  }
  revalidatePath("/app/pro", "layout");
  return { ok: true, data: undefined };
}

export async function setPrimaryListingAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const id = z.uuid().safeParse(formData.get("professionalId"));
    if (!id.success) throw new ValidationError();
    await setPrimaryListing(actor, id.data);
    revalidatePath("/app/pro");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

const organizationIdSchema = z.uuid();

export async function inviteMemberAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const organizationId = organizationIdSchema.safeParse(form.get("organizationId"));
  if (!organizationId.success) return toActionError(new ValidationError());
  const parsed = inviteMemberSchema.safeParse(formToObject(form));
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await inviteMember(actor, organizationId.data, parsed.data);
  } catch (e) {
    return toActionErrorWithFields(e);
  }
  revalidatePath("/app/pro/structure");
  return { ok: true, data: undefined };
}

export async function changeMemberRoleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const organizationId = organizationIdSchema.safeParse(form.get("organizationId"));
  const parsed = changeMemberRoleSchema.safeParse(formToObject(form));
  if (!organizationId.success || !parsed.success) return toActionError(new ValidationError("Choisissez un rôle."));
  try {
    await changeMemberRole(actor, organizationId.data, parsed.data.memberId, parsed.data.role);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/app/pro/structure");
  return { ok: true, data: undefined };
}

export async function removeMemberAction(organizationId: string, memberId: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await removeMember(actor, organizationIdSchema.parse(organizationId), z.uuid().parse(memberId));
    revalidatePath("/app/pro", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function revokeMemberInvitationAction(organizationId: string, invitationId: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await revokeOrganizationInvitation(actor, organizationIdSchema.parse(organizationId), z.uuid().parse(invitationId));
    revalidatePath("/app/pro/structure");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
