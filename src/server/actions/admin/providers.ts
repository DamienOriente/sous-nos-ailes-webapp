"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ProviderVettingStatus, QualificationStatus } from "@/generated/prisma/enums";
import { requireActionUser } from "@/server/authz";
import { DomainError } from "@/server/errors";
import { addAvailability, addQualification, createProvider, removeAvailability, setQualificationStatus, setVettingStatus, updateProvider } from "@/server/services/providers";
import { availabilitySchema, providerSchema, qualificationSchema } from "@/validation/admin";
import { formDataToObject } from "@/validation/common";
import { zonedDateTimeToUtc } from "@/lib/time";
import { type FormState, actionMessageFor, eurosToCentsFields, firstIssueMessage, flashUrl, formErrorState, formSuccessState, readString, validationErrorState } from "@/server/actions/admin/helpers";

const providerUpdateSchema = providerSchema.omit({ email: true }).extend({
  isActive: z.literal("on").optional().transform((v) => v === "on"),
});

function providerPath(providerId: string): string {
  return `/admin/intervenants/${providerId}`;
}

function revalidateProvider(providerId: string): void {
  revalidatePath(providerPath(providerId));
  revalidatePath("/admin/intervenants");
}

/** Creates the user + profile and emails a login link; redirects to the new profile. */
export async function createProviderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let providerId: string;
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const { data, fieldErrors } = eurosToCentsFields(formDataToObject(formData), ["agreedCostCents"]);
    if (Object.keys(fieldErrors).length) return formErrorState("Vérifiez les champs du formulaire.", formData, fieldErrors);
    const parsed = providerSchema.safeParse(data);
    if (!parsed.success) return validationErrorState(parsed.error, formData);
    providerId = await createProvider(parsed.data, actor);
    revalidatePath("/admin/intervenants");
  } catch (error) {
    return formErrorState(actionMessageFor(error), formData);
  }
  redirect(flashUrl(providerPath(providerId), { notice: "Profil créé. Un lien de connexion a été envoyé par email à la personne." }));
}

export async function updateProviderAction(providerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const { data, fieldErrors } = eurosToCentsFields(formDataToObject(formData), ["agreedCostCents"]);
    if (Object.keys(fieldErrors).length) return formErrorState("Vérifiez les champs du formulaire.", formData, fieldErrors);
    const parsed = providerUpdateSchema.safeParse(data);
    if (!parsed.success) return validationErrorState(parsed.error, formData);
    await updateProvider(providerId, parsed.data, actor);
    revalidateProvider(providerId);
    return formSuccessState("Profil mis à jour.");
  } catch (error) {
    return formErrorState(actionMessageFor(error), formData);
  }
}

function isVettingStatus(value: string): value is ProviderVettingStatus {
  return Object.values(ProviderVettingStatus).includes(value as ProviderVettingStatus);
}

function isQualificationStatus(value: string): value is QualificationStatus {
  return Object.values(QualificationStatus).includes(value as QualificationStatus);
}

/** Manual vetting by Marie: a working status, never a certification. */
export async function setVettingStatusAction(providerId: string, formData: FormData): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const status = readString(formData, "status");
    const note = readString(formData, "note");
    if (!isVettingStatus(status)) throw new DomainError("Statut de vérification inconnu.");
    if (note.length > 1000) throw new DomainError("Note trop longue (1000 caractères maximum).");
    await setVettingStatus(providerId, status, note || null, actor);
    flash = { notice: "Statut de vérification enregistré." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateProvider(providerId);
  redirect(flashUrl(providerPath(providerId), flash));
}

export async function addQualificationAction(providerId: string, formData: FormData): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const parsed = qualificationSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      flash = { error: firstIssueMessage(parsed.error) };
    } else {
      await addQualification(providerId, parsed.data, actor.id, actor.role);
      flash = { notice: "Qualification déclarée ajoutée (à vérifier)." };
    }
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateProvider(providerId);
  redirect(flashUrl(providerPath(providerId), flash));
}

/** `status` comes from the clicked button (VERIFIED, REJECTED or back to DECLARED). */
export async function setQualificationStatusAction(providerId: string, qualificationId: string, formData: FormData): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const status = readString(formData, "status");
    const note = readString(formData, "note");
    if (!isQualificationStatus(status)) throw new DomainError("Statut de qualification inconnu.");
    if (note.length > 500) throw new DomainError("Note trop longue (500 caractères maximum).");
    await setQualificationStatus(qualificationId, status, note || null, actor);
    flash = { notice: "Statut de la qualification enregistré." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateProvider(providerId);
  redirect(flashUrl(providerPath(providerId), flash));
}

export async function addAvailabilityAction(providerId: string, formData: FormData): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const parsed = availabilitySchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      flash = { error: firstIssueMessage(parsed.error) };
    } else {
      const { kind, startDate, startTime, endDate, endTime, note } = parsed.data;
      await addAvailability(
        providerId,
        { kind, startsAt: zonedDateTimeToUtc(startDate, startTime), endsAt: zonedDateTimeToUtc(endDate, endTime), note: note ?? null },
        actor.id,
        actor.role,
      );
      flash = { notice: kind === "AVAILABLE" ? "Disponibilité ajoutée." : "Indisponibilité ajoutée." };
    }
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateProvider(providerId);
  redirect(flashUrl(providerPath(providerId), flash));
}

export async function removeAvailabilityAction(providerId: string, availabilityId: string): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    await requireActionUser(["ADMIN"]);
    await removeAvailability(providerId, availabilityId);
    flash = { notice: "Période supprimée." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateProvider(providerId);
  redirect(flashUrl(providerPath(providerId), flash));
}
