"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { zonedDateTimeToUtc } from "@/lib/time";
import { requireActionUser } from "@/server/authz";
import { errorState, successState, type ActionState } from "@/server/action-state";
import { AuthorizationError, userMessageFor } from "@/server/errors";
import { respondToInvitation } from "@/server/services/invitations";
import { addAvailability, addQualification, removeAvailability, updateProvider } from "@/server/services/providers";
import { getSettings } from "@/server/services/settings";
import { availabilitySchema, qualificationSchema } from "@/validation/admin";
import { cuidSchema, fieldErrorsOf, formDataToObject } from "@/validation/common";
import { invitationResponseSchema, providerProfileSchema } from "@/components/portal/schemas";
import { flashQuery, type FlashInput } from "@/components/portal/flash";

const PROVIDER_HOME = "/espace-intervenant";
const AVAILABILITIES_PATH = "/espace-intervenant/disponibilites";
const PROFILE_PATH = "/espace-intervenant/profil";

type SavedState = ActionState<{ savedAt: number }>;

async function currentProvider() {
  const user = await requireActionUser(["PROVIDER"]);
  const profile = await db.providerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new AuthorizationError();
  return { user, profile };
}

/** Only paths inside the provider space are accepted as redirect targets. */
function safeReturnPath(value: string | undefined): string {
  if (!value) return PROVIDER_HOME;
  const inside = value === PROVIDER_HOME || value.startsWith(`${PROVIDER_HOME}/`);
  if (!inside || value.includes("//") || value.includes("\\")) return PROVIDER_HOME;
  return value;
}

export async function respondToInvitationAction(formData: FormData): Promise<void> {
  const parsed = invitationResponseSchema.safeParse(formDataToObject(formData));
  const target = safeReturnPath(parsed.success ? parsed.data.returnTo : undefined);
  let flash: FlashInput;
  if (!parsed.success) {
    flash = { error: "Réponse invalide. Réessayez depuis la proposition." };
  } else {
    try {
      const { user } = await currentProvider();
      await respondToInvitation(parsed.data.invitationId, user.id, parsed.data.response, parsed.data.note);
      const settings = await getSettings();
      flash =
        parsed.data.response === "ACCEPTED"
          ? { message: `Votre disponibilité est transmise. L’affectation sera confirmée par ${settings.ownerFirstName}.` }
          : { message: "Votre refus est enregistré. Merci d’avoir répondu." };
    } catch (error) {
      flash = { error: userMessageFor(error) };
    }
  }
  revalidatePath(PROVIDER_HOME, "layout");
  redirect(`${target}?${flashQuery(flash)}`);
}

export async function addAvailabilityAction(_prev: SavedState, formData: FormData): Promise<SavedState> {
  try {
    const { user, profile } = await currentProvider();
    const parsed = availabilitySchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return errorState("Vérifiez les champs du formulaire.", fieldErrorsOf(parsed.error));
    const { kind, startDate, startTime, endDate, endTime, note } = parsed.data;
    await addAvailability(
      profile.id,
      { kind, startsAt: zonedDateTimeToUtc(startDate, startTime), endsAt: zonedDateTimeToUtc(endDate, endTime), note },
      user.id,
      "PROVIDER",
    );
    revalidatePath(AVAILABILITIES_PATH);
    return successState(kind === "AVAILABLE" ? "Disponibilité enregistrée." : "Indisponibilité enregistrée.", { savedAt: Date.now() });
  } catch (error) {
    return errorState(userMessageFor(error));
  }
}

export async function removeAvailabilityAction(availabilityId: string): Promise<void> {
  let flash: FlashInput;
  try {
    const { profile } = await currentProvider();
    const id = cuidSchema.safeParse(availabilityId);
    if (!id.success) throw new AuthorizationError("Période introuvable.");
    await removeAvailability(profile.id, id.data);
    flash = { message: "Période retirée." };
  } catch (error) {
    flash = { error: userMessageFor(error) };
  }
  revalidatePath(AVAILABILITIES_PATH);
  redirect(`${AVAILABILITIES_PATH}?${flashQuery(flash)}`);
}

export async function updateProviderProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user, profile } = await currentProvider();
    const parsed = providerProfileSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return errorState("Vérifiez les champs du formulaire.", fieldErrorsOf(parsed.error));
    // Only the whitelisted profile fields reach the service: costs and vetting stay out of reach.
    await updateProvider(profile.id, parsed.data, user);
    revalidatePath(PROFILE_PATH);
    return successState("Profil mis à jour.");
  } catch (error) {
    return errorState(userMessageFor(error));
  }
}

export async function addQualificationAction(_prev: SavedState, formData: FormData): Promise<SavedState> {
  try {
    const { user, profile } = await currentProvider();
    const parsed = qualificationSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return errorState("Vérifiez les champs du formulaire.", fieldErrorsOf(parsed.error));
    await addQualification(profile.id, parsed.data, user.id, "PROVIDER");
    revalidatePath(PROFILE_PATH);
    const settings = await getSettings();
    return successState(`Qualification déclarée. ${settings.ownerFirstName} la vérifiera manuellement.`, { savedAt: Date.now() });
  } catch (error) {
    return errorState(userMessageFor(error));
  }
}
