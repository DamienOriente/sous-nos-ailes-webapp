"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionUser } from "@/server/authz";
import { errorState, successState, type ActionState } from "@/server/action-state";
import { userMessageFor } from "@/server/errors";
import { updateClientPreparation } from "@/server/services/events";
import { acceptVersion } from "@/server/services/quotes";
import { getSettings } from "@/server/services/settings";
import { clientPreparationSchema } from "@/validation/admin";
import { cuidSchema, fieldErrorsOf, formDataToObject } from "@/validation/common";
import { acceptProposalSchema } from "@/components/portal/schemas";
import { flashQuery, type FlashInput } from "@/components/portal/flash";

// Ownership is enforced by the services (every query is scoped to the acting
// client); the actions only validate input and translate errors for the user.

export async function saveClientPreparation(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireActionUser();
    const id = cuidSchema.safeParse(eventId);
    if (!id.success) return errorState("Dossier introuvable.");
    const parsed = clientPreparationSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return errorState("Vérifiez les champs du formulaire.", fieldErrorsOf(parsed.error));
    await updateClientPreparation(id.data, user.id, parsed.data);
    revalidatePath(`/espace-client/evenements/${id.data}`);
    const settings = await getSettings();
    return successState(`Vos réponses sont enregistrées. ${settings.ownerFirstName} les prendra en compte dans la préparation.`);
  } catch (error) {
    return errorState(userMessageFor(error));
  }
}

/** Agreement in principle on the current SENT version. Redirects back to the file with a flash. */
export async function acceptProposal(eventId: string, versionId: string): Promise<void> {
  const ids = acceptProposalSchema.safeParse({ eventId, versionId });
  if (!ids.success) redirect(`/espace-client?${flashQuery({ error: "Proposition introuvable." })}`);
  const target = `/espace-client/evenements/${ids.data.eventId}`;
  let flash: FlashInput;
  try {
    const user = await requireActionUser();
    await acceptVersion(ids.data.versionId, user);
    const settings = await getSettings();
    flash = { message: `Votre accord de principe est enregistré. ${settings.ownerFirstName} constitue maintenant l’équipe ; la prestation sera confirmée une fois les points pratiques validés.` };
  } catch (error) {
    flash = { error: userMessageFor(error) };
  }
  revalidatePath(target);
  redirect(`${target}?${flashQuery(flash)}`);
}
