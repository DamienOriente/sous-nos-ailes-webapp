import type { z } from "zod";
import { ValidationError, type ActionResult } from "@/lib/errors";

/** Shared helpers for server actions: Zod issues → ActionResult with field errors. */
export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}

export function invalidResult(error: z.ZodError): ActionResult<never> {
  return { ok: false, error: error.issues[0]?.message ?? new ValidationError().message, code: "validation", fieldErrors: zodFieldErrors(error) };
}

/** FormData → plain object, with empty strings kept (schemas turn them into null). */
export function formObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
