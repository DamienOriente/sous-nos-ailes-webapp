"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionUser } from "@/server/authz";
import { errorState, successState, type ActionState } from "@/server/action-state";
import { ConflictError, DomainError } from "@/server/errors";
import { inviteProviders, withdrawInvitation } from "@/server/services/invitations";
import { assignProvider, cancelAssignment } from "@/server/services/assignments";
import { parseEurosToCents } from "@/lib/money";
import { actionMessageFor, flashUrl, readString } from "@/server/actions/admin/helpers";

function eventPath(eventId: string): string {
  return `/admin/evenements/${eventId}`;
}

function revalidateTeam(eventId: string): void {
  revalidatePath(eventPath(eventId));
  revalidatePath("/admin/evenements");
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
}

export type AssignState = ActionState<{ details: string[] }>;

/** Proposes the mission to the ticked candidates (`providerIds[]`) with an optional message. */
export async function inviteProvidersAction(eventId: string, formData: FormData): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const providerIds = formData.getAll("providerIds[]").filter((v): v is string => typeof v === "string");
    const message = readString(formData, "message");
    if (!providerIds.length) throw new DomainError("Cochez au moins une personne à qui proposer la mission.");
    if (message.length > 1000) throw new DomainError("Message trop long (1000 caractères maximum).");
    const sent = await inviteProviders(eventId, providerIds, actor, message || null);
    flash = sent
      ? { notice: `Mission proposée à ${sent} personne${sent > 1 ? "s" : ""}. Chacune reçoit un email avec un lien de connexion.` }
      : { error: "Aucune proposition envoyée : les personnes cochées ont déjà une proposition en cours ou un profil inactif." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateTeam(eventId);
  redirect(flashUrl(eventPath(eventId), flash) + (flash.error ? "" : "#equipe"));
}

export async function withdrawInvitationAction(eventId: string, invitationId: string): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    await withdrawInvitation(invitationId, actor);
    flash = { notice: "Proposition retirée." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateTeam(eventId);
  redirect(flashUrl(eventPath(eventId), flash));
}

/** Confirms an accepted invitation as an assignment. Conflicts come back as explicit details. */
export async function assignProviderAction(eventId: string, invitationId: string, providerId: string, _prev: AssignState, formData: FormData): Promise<AssignState> {
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const roleLabel = readString(formData, "roleLabel");
    const costInput = readString(formData, "agreedCost");
    let agreedCostCents: number | undefined;
    if (costInput) {
      const cents = parseEurosToCents(costInput);
      if (cents === null || cents < 0) return errorState("Montant invalide (exemple : 120,00).", { agreedCost: ["Montant invalide (exemple : 120,00)."] });
      agreedCostCents = cents;
    }
    if (roleLabel.length > 80) return errorState("Rôle trop long (80 caractères maximum).", { roleLabel: ["80 caractères maximum."] });
    await assignProvider({ eventId, providerId, invitationId, agreedCostCents, roleLabel: roleLabel || null }, actor);
    revalidateTeam(eventId);
    return successState("Personne affectée à l’équipe.");
  } catch (error) {
    if (error instanceof ConflictError) return { status: "error", message: error.message, data: { details: error.details } };
    return errorState(actionMessageFor(error));
  }
}

export async function cancelAssignmentAction(eventId: string, assignmentId: string, formData: FormData): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const reason = readString(formData, "reason") || undefined;
    await cancelAssignment(assignmentId, actor, reason);
    flash = { notice: "Personne retirée de l’équipe." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateTeam(eventId);
  redirect(flashUrl(eventPath(eventId), flash));
}
