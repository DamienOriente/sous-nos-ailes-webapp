"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionUser } from "@/server/authz";
import { DomainError } from "@/server/errors";
import { getOrCreateDraft, sendVersion, updateDraft, withdrawVersion, type QuoteVersionInput } from "@/server/services/quotes";
import { quoteVersionSchema } from "@/validation/admin";
import { formDataToObject } from "@/validation/common";
import { type FormState, actionMessageFor, firstIssueMessage, flashUrl, formErrorState, formSuccessState, percentToBps, validationErrorState } from "@/server/actions/admin/helpers";
import type { SessionUser } from "@/lib/auth/session";
import type { z } from "zod";

function eventPath(eventId: string): string {
  return `/admin/evenements/${eventId}`;
}

function editorPath(eventId: string, versionId: string): string {
  return `${eventPath(eventId)}/propositions/${versionId}/modifier`;
}

function revalidateQuote(eventId: string, versionId?: string): void {
  revalidatePath(eventPath(eventId));
  revalidatePath("/admin/evenements");
  if (versionId) {
    revalidatePath(editorPath(eventId, versionId));
    revalidatePath(`${eventPath(eventId)}/propositions/${versionId}`);
  }
}

/**
 * The editor serialises its lines as JSON (`linesJson`), with quantities already
 * in hundredths and prices in cents; the VAT rate arrives as a percent string.
 */
function parseQuoteForm(formData: FormData): { ok: true; data: QuoteVersionInput } | { ok: false; error: z.ZodError } {
  const raw = formDataToObject(formData);
  let lines: unknown = [];
  if (typeof raw.linesJson === "string") {
    try {
      lines = JSON.parse(raw.linesJson);
    } catch {
      lines = [];
    }
  }
  // A disabled "Taux de TVA" input is not submitted: no VAT means a 0 rate.
  const vatRateBps = raw.vatMode === "NONE" ? 0 : percentToBps(raw.vatRatePercent);
  const parsed = quoteVersionSchema.safeParse({ ...raw, lines, vatRateBps: vatRateBps ?? "invalid" });
  if (!parsed.success) return { ok: false, error: parsed.error };
  return { ok: true, data: parsed.data };
}

/** "Préparer une nouvelle version": reuses the open draft or creates one from the current version. */
export async function createDraftAction(eventId: string): Promise<void> {
  let target: string;
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const draft = await getOrCreateDraft(eventId, actor);
    revalidateQuote(eventId, draft.id);
    target = editorPath(eventId, draft.id);
  } catch (error) {
    target = flashUrl(eventPath(eventId), { error: actionMessageFor(error) });
  }
  redirect(target);
}

export async function saveDraftAction(versionId: string, eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireActionUser(["ADMIN"]);
    const parsed = parseQuoteForm(formData);
    if (!parsed.ok) return validationErrorState(parsed.error, formData);
    await updateDraft(versionId, parsed.data, actor);
    revalidateQuote(eventId, versionId);
    return formSuccessState("Brouillon enregistré. Les totaux ont été recalculés côté serveur.");
  } catch (error) {
    return formErrorState(actionMessageFor(error), formData);
  }
}

async function saveThenSend(versionId: string, formData: FormData, actor: SessionUser): Promise<void> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) throw new DomainError(firstIssueMessage(parsed.error));
  await updateDraft(versionId, parsed.data, actor);
  await sendVersion(versionId, actor);
}

/** Saves the current edits then freezes and emails the version to the client. */
export async function saveAndSendDraftAction(versionId: string, eventId: string, formData: FormData): Promise<void> {
  let target: string;
  try {
    const actor = await requireActionUser(["ADMIN"]);
    await saveThenSend(versionId, formData, actor);
    revalidateQuote(eventId, versionId);
    target = flashUrl(eventPath(eventId), { notice: "Proposition transmise au client. Un email avec un lien de connexion lui a été envoyé." });
  } catch (error) {
    revalidateQuote(eventId, versionId);
    target = flashUrl(editorPath(eventId, versionId), { error: actionMessageFor(error) });
  }
  redirect(target);
}

export async function withdrawDraftAction(versionId: string, eventId: string): Promise<void> {
  let flash: { notice?: string; error?: string };
  try {
    const actor = await requireActionUser(["ADMIN"]);
    await withdrawVersion(versionId, actor);
    flash = { notice: "Brouillon supprimé." };
  } catch (error) {
    flash = { error: actionMessageFor(error) };
  }
  revalidateQuote(eventId);
  redirect(flashUrl(eventPath(eventId), flash));
}
