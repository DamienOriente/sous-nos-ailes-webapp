import { z } from "zod";
import { WorkflowError } from "@/domain/workflow";
import { parseEurosToCents } from "@/lib/money";
import type { ActionState } from "@/server/action-state";
import { userMessageFor } from "@/server/errors";
import { fieldErrorsOf } from "@/validation/common";

/** Builds a redirect target carrying a one-shot notice or error for the Flash component. */
export function flashUrl(path: string, flash: { notice?: string; error?: string }): string {
  const params = new URLSearchParams();
  if (flash.notice) params.set("notice", flash.notice);
  if (flash.error) params.set("error", flash.error);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** First human-readable message of a Zod error, for forms without per-field display. */
export function firstIssueMessage(error: z.ZodError, fallback = "Vérifiez les champs du formulaire."): string {
  const flat = z.flattenError(error);
  const fieldMessage = Object.values(flat.fieldErrors as Record<string, string[] | undefined>).find((m) => m && m.length)?.[0];
  return fieldMessage ?? flat.formErrors[0] ?? fallback;
}

/**
 * React resets uncontrolled form fields once a Server Action settles, even when
 * it returns a validation error. Actions therefore echo the submitted values so
 * forms can use them as `defaultValue` and nothing typed is lost.
 */
export type FormValues = Record<string, string>;
export type FormState = ActionState<{ values: FormValues }>;

export function formValuesOf(formData: FormData): FormValues {
  const values: FormValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

export function formErrorState(message: string, formData: FormData, fieldErrors?: Record<string, string[]>): FormState {
  return { status: "error", message, fieldErrors, data: { values: formValuesOf(formData) } };
}

export function validationErrorState(error: z.ZodError, formData: FormData): FormState {
  return formErrorState("Vérifiez les champs du formulaire.", formData, fieldErrorsOf(error));
}

export function formSuccessState(message: string): FormState {
  return { status: "success", message };
}

const MONEY_ERROR = "Montant invalide (exemple : 35,00).";

/**
 * Replaces euro-formatted inputs ("35,50") by integer cents in a parsed form object,
 * so that schemas expecting cents can validate them. Empty values are left as "".
 * Returns field errors for unparseable amounts.
 */
export function eurosToCentsFields(raw: Record<string, unknown>, keys: string[]): { data: Record<string, unknown>; fieldErrors: Record<string, string[]> } {
  const data = { ...raw };
  const fieldErrors: Record<string, string[]> = {};
  for (const key of keys) {
    const value = raw[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) {
      data[key] = "";
      continue;
    }
    const cents = parseEurosToCents(trimmed);
    if (cents === null) fieldErrors[key] = [MONEY_ERROR];
    else data[key] = String(cents);
  }
  return { data, fieldErrors };
}

/** "20" or "20,5" (percent) → basis points. Same arithmetic as euros → cents. */
export function percentToBps(value: unknown): number | null {
  if (typeof value !== "string") return null;
  return parseEurosToCents(value.trim());
}

export function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Message safe to show for any error raised by services or domain helpers. */
export function actionMessageFor(error: unknown): string {
  if (error instanceof WorkflowError) return error.message;
  return userMessageFor(error);
}
