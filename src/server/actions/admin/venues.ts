"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EditorialStatus } from "@/generated/prisma/enums";
import { requireActionUser } from "@/server/authz";
import { createVenue, linkPartnerUser, markVenueVerified, setEditorialStatus, updateVenue } from "@/server/services/venues";
import { venueSchema } from "@/validation/admin";
import { emailSchema, formDataToObject, requiredString } from "@/validation/common";
import { EDITORIAL_STATUS_LABELS } from "@/domain/labels";
import { type FormState, actionMessageFor, firstIssueMessage, flashUrl, formErrorState, formSuccessState, validationErrorState } from "@/server/actions/admin/helpers";

const partnerUserSchema = z.object({ email: emailSchema, name: requiredString(120, "Le nom") });

function venuePath(venueId: string): string {
  return `/admin/lieux/${venueId}`;
}

function revalidateVenue(venueId: string): void {
  revalidatePath(venuePath(venueId));
  revalidatePath("/admin/lieux");
  revalidatePath("/lieux", "layout");
}

export async function createVenueAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let venueId: string;
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const parsed = venueSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return validationErrorState(parsed.error, formData);
    venueId = await createVenue(parsed.data, actor);
    revalidatePath("/admin/lieux");
  } catch (error) {
    return formErrorState(actionMessageFor(error), formData);
  }
  redirect(flashUrl(venuePath(venueId), { notice: "Lieu créé en brouillon. Complétez la fiche puis envoyez-la en validation." }));
}

export async function updateVenueAction(venueId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const parsed = venueSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return validationErrorState(parsed.error, formData);
    await updateVenue(venueId, parsed.data, actor);
    revalidateVenue(venueId);
    return formSuccessState("Fiche du lieu mise à jour.");
  } catch (error) {
    return formErrorState(actionMessageFor(error), formData);
  }
}

export async function setEditorialStatusAction(venueId: string, status: EditorialStatus): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    await setEditorialStatus(venueId, status, actor);
    flash = { notice: `Page : ${EDITORIAL_STATUS_LABELS[status]}.` };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateVenue(venueId);
  redirect(flashUrl(venuePath(venueId), flash));
}

export async function markVenueVerifiedAction(venueId: string): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    await markVenueVerified(venueId, actor);
    flash = { notice: "Informations marquées comme vérifiées aujourd’hui." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateVenue(venueId);
  redirect(flashUrl(venuePath(venueId), flash));
}

/** Creates or reuses a PARTNER account and attaches it to the venue. No email is sent here. */
export async function linkPartnerUserAction(venueId: string, formData: FormData): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const parsed = partnerUserSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      flash = { error: firstIssueMessage(parsed.error) };
    } else {
      await linkPartnerUser(venueId, parsed.data, actor);
      flash = { notice: "Compte partenaire rattaché. La personne pourra demander un lien de connexion depuis la page de connexion." };
    }
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateVenue(venueId);
  redirect(flashUrl(venuePath(venueId), flash));
}
