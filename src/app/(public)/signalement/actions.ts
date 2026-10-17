"use server";
import { headers } from "next/headers";
import { toActionError, type ActionResult } from "@/lib/errors";
import { getActor } from "@/lib/session";
import { track } from "@/modules/analytics/application/track";
import { reportSchema, submitReport } from "@/modules/legal/application/public-forms";
import { clientKeyFromHeaders } from "@/modules/legal/infrastructure/rate-limit";

export type ReportFormState = ((ActionResult<{ reportId: string | null }>) & { values?: Record<string, string> }) | null;

export async function sendReport(_prev: ReportFormState, formData: FormData): Promise<ReportFormState> {
  const values = Object.fromEntries(["resourceType", "resourceRef", "reason", "details", "reporterEmail"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = reportSchema.safeParse({ ...values, website: formData.get("website") ?? "" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: "Vérifiez les champs signalés.", code: "validation", fieldErrors, values };
  }
  try {
    const h = await headers();
    const actor = await getActor();
    const res = await submitReport(parsed.data, { clientKey: clientKeyFromHeaders(h), userId: actor?.userId ?? null });
    await track("report.submitted", { resourceType: parsed.data.resourceType, reason: parsed.data.reason }, { userId: actor?.userId ?? null });
    return { ok: true, data: res };
  } catch (e) {
    return { ...toActionError(e), values };
  }
}
