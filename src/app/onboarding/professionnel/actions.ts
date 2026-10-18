"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActorOrThrow } from "@/lib/session";
import type { FormState } from "@/components/professionals/action-form";
import { eurosToCents, formToObject, toActionErrorWithFields, validationResult } from "@/modules/professionals/application/form-parsing";
import { createDraft, getManagedListing, saveStep1, saveStep2, saveStep3, saveStep4, saveTemplateChoice, submitForReview } from "@/modules/professionals/application/professional-service";
import { step1Schema, step2Schema, step4Schema, step5Schema } from "@/modules/professionals/domain/listing-schema";
import { tradeFormDataToObject } from "@/modules/professionals/domain/trade-forms";
import { activateDefaultTools } from "@/modules/tools/application/tool-service";
import { redirectOnListingQuota } from "@/app/app/pro/agency-flow";

const idSchema = z.uuid();

function stepUrl(id: string, step: number): string {
  return `/onboarding/professionnel?id=${id}&step=${step}`;
}

function wantsExit(form: FormData): boolean {
  return form.get("intent") === "exit";
}

export async function step1Action(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const parsed = step1Schema.safeParse(formToObject(form, ["secondaryCategoryIds"]));
  if (!parsed.success) return validationResult(parsed.error);
  const rawId = form.get("id");
  let id: string;
  try {
    if (typeof rawId === "string" && idSchema.safeParse(rawId).success) {
      await saveStep1(actor, rawId, parsed.data);
      id = rawId;
    } else {
      id = (await createDraft(actor, parsed.data)).id;
    }
    await activateDefaultTools(id);
  } catch (e) {
    redirectOnListingQuota(e);
    return toActionErrorWithFields(e);
  }
  redirect(wantsExit(form) ? "/app/pro" : stepUrl(id, 2));
}

export async function step2Action(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const id = idSchema.parse(form.get("id"));
  const parsed = step2Schema.safeParse(formToObject(form));
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await saveStep2(actor, id, parsed.data);
  } catch (e) {
    return toActionErrorWithFields(e);
  }
  redirect(wantsExit(form) ? "/app/pro" : stepUrl(id, 3));
}

export async function step3Action(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const id = idSchema.parse(form.get("id"));
  try {
    const { category } = await getManagedListing(actor, id);
    await saveStep3(actor, id, tradeFormDataToObject(category.formSchemaKey, form));
  } catch (e) {
    return toActionErrorWithFields(e);
  }
  redirect(wantsExit(form) ? "/app/pro" : stepUrl(id, 4));
}

export async function step4Action(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const id = idSchema.parse(form.get("id"));
  const raw = formToObject(form, ["languages", "eventTypes"]);
  raw.priceFromCents = eurosToCents(raw.priceFromEuros);
  raw.priceToCents = eurosToCents(raw.priceToEuros);
  raw.acceptsChildrenServices = raw.acceptsChildrenServices === "on";
  const parsed = step4Schema.safeParse(raw);
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await saveStep4(actor, id, parsed.data);
  } catch (e) {
    return toActionErrorWithFields(e);
  }
  redirect(wantsExit(form) ? "/app/pro" : stepUrl(id, 5));
}

export async function step5Action(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const id = idSchema.parse(form.get("id"));
  const parsed = step5Schema.safeParse(formToObject(form));
  if (!parsed.success) return validationResult(parsed.error);
  try {
    await saveTemplateChoice(actor, id, parsed.data.templateKey);
    if (!wantsExit(form)) await submitForReview(actor, id);
  } catch (e) {
    redirectOnListingQuota(e, id);
    return toActionErrorWithFields(e);
  }
  redirect(wantsExit(form) ? "/app/pro" : `/app/pro/${id}?submitted=1`);
}
