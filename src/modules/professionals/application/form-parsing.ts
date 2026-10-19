import type { z } from "zod";
import { isAppError, type ActionResult } from "@/lib/errors";

/** FormData → plain object; repeated keys become arrays, empty strings stay (schemas decide). */
export function formToObject(form: FormData, arrayKeys: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = form.getAll(key).map((v) => (typeof v === "string" ? v : ""));
    out[key] = arrayKeys.includes(key) ? all : all[0];
  }
  for (const k of arrayKeys) if (!(k in out)) out[k] = [];
  return out;
}

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export function validationResult(error: z.ZodError): ActionResult<never> {
  return { ok: false, code: "validation", error: "Vérifiez les champs signalés.", fieldErrors: zodFieldErrors(error) };
}

/** Like toActionError but keeps `fieldErrors` carried by a ValidationError's details. */
export function toActionErrorWithFields(e: unknown): ActionResult<never> {
  if (isAppError(e)) {
    const fieldErrors = e.details && typeof e.details === "object" && "fieldErrors" in e.details ? (e.details.fieldErrors as Record<string, string[]>) : undefined;
    return { ok: false, error: e.message, code: e.code, fieldErrors };
  }
  return { ok: false, error: "Une erreur inattendue est survenue.", code: "internal" };
}

export function optionalNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  return v as number;
}

/** Euros typed in a form → integer cents (or null). */
export function eurosToCents(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
