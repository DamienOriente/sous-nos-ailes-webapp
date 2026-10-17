"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EventStatus } from "@/generated/prisma/enums";
import { MANUAL_TRANSITIONS } from "@/domain/workflow";
import { EVENT_STATUS_LABELS } from "@/domain/labels";
import { requireActionUser } from "@/server/authz";
import { DomainError } from "@/server/errors";
import { getEventForAdmin, transitionEvent, updateEventDetails, validateOperations } from "@/server/services/events";
import { addChecklistItem, removeChecklistItem, setChecklistItemDone } from "@/server/services/checklist";
import { clientPreparationSchema, eventDetailsSchema } from "@/validation/admin";
import { formDataToObject } from "@/validation/common";
import { type FormState, actionMessageFor, flashUrl, formErrorState, formSuccessState, readString, validationErrorState } from "@/server/actions/admin/helpers";

function eventPath(eventId: string): string {
  return `/admin/evenements/${eventId}`;
}

function revalidateEvent(eventId: string): void {
  revalidatePath(eventPath(eventId));
  revalidatePath("/admin/evenements");
  revalidatePath("/admin/planning");
  revalidatePath("/admin");
}

function isEventStatus(value: string): value is EventStatus {
  return Object.values(EventStatus).includes(value as EventStatus);
}

/** Manual status change; `to` comes from the clicked button, `reason` from the optional textarea. */
export async function transitionEventAction(eventId: string, formData: FormData): Promise<void> {
  let flash: { notice?: string; error?: string } = {};
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const to = readString(formData, "to");
    const reason = readString(formData, "reason") || undefined;
    if (!isEventStatus(to)) throw new DomainError("Statut inconnu.");
    const event = await getEventForAdmin(eventId);
    if (!event) throw new DomainError("Événement introuvable.");
    if (!MANUAL_TRANSITIONS[event.status].includes(to)) {
      flash = { error: `Le passage vers « ${EVENT_STATUS_LABELS[to]} » n’est pas possible depuis « ${EVENT_STATUS_LABELS[event.status]} ».` };
    } else {
      await transitionEvent(eventId, to, actor, reason);
      flash = { notice: `Statut mis à jour : ${EVENT_STATUS_LABELS[to]}.` };
    }
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateEvent(eventId);
  redirect(flashUrl(eventPath(eventId), flash));
}

export async function setOpsValidationAction(eventId: string, validated: boolean): Promise<void> {
  let flash: { notice?: string; error?: string } = {};
  try {
    const actor = await requireActionUser(["ADMIN"]);
    await validateOperations(eventId, actor, validated);
    flash = { notice: validated ? "Points opérationnels validés." : "Validation opérationnelle retirée." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateEvent(eventId);
  redirect(flashUrl(eventPath(eventId), flash));
}

export async function updateEventDetailsAction(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const parsed = eventDetailsSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return validationErrorState(parsed.error, formData);
    await updateEventDetails(eventId, parsed.data, actor);
    revalidateEvent(eventId);
    return formSuccessState("Fiche mise à jour. Le titre et la checklist ont été recalculés.");
  } catch (error) {
    return formErrorState(actionMessageFor(error), formData);
  }
}

/** Preparation answers (space, meeting point, on-site contact, schedule) edited by Marie. */
export async function updatePreparationAction(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const parsed = clientPreparationSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return validationErrorState(parsed.error, formData);
    await updateEventDetails(eventId, parsed.data, actor);
    revalidateEvent(eventId);
    return formSuccessState("Préparation mise à jour.");
  } catch (error) {
    return formErrorState(actionMessageFor(error), formData);
  }
}

export async function toggleChecklistItemAction(eventId: string, itemId: string, done: boolean): Promise<void> {
  let flash: { notice?: string; error?: string } = {};
  try {
    await requireActionUser(["ADMIN"]);
    await setChecklistItemDone(eventId, itemId, done);
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateEvent(eventId);
  redirect(flashUrl(`${eventPath(eventId)}`, flash) + (flash.error ? "" : "#checklist"));
}

export async function addChecklistItemAction(eventId: string, formData: FormData): Promise<void> {
  let flash: { notice?: string; error?: string } = {};
  try {
    await requireActionUser(["ADMIN"]);
    const label = readString(formData, "label");
    if (label.length < 2 || label.length > 200) throw new DomainError("Libellé requis (200 caractères maximum).");
    await addChecklistItem(eventId, label);
    flash = { notice: "Élément ajouté à la checklist." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateEvent(eventId);
  redirect(flashUrl(eventPath(eventId), flash));
}

export async function removeChecklistItemAction(eventId: string, itemId: string): Promise<void> {
  let flash: { notice?: string; error?: string } = {};
  try {
    await requireActionUser(["ADMIN"]);
    await removeChecklistItem(eventId, itemId);
    flash = { notice: "Élément retiré de la checklist." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateEvent(eventId);
  redirect(flashUrl(eventPath(eventId), flash));
}
