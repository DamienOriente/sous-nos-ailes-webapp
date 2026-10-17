"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/errors";
import { toActionError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import type { FormState } from "@/components/professionals/action-form";
import { eurosToCents, formToObject, toActionErrorWithFields, validationResult } from "@/modules/professionals/application/form-parsing";
import { archiveListing, getManagedListing, submitForReview, updateListing } from "@/modules/professionals/application/professional-service";
import { listingEditSchema } from "@/modules/professionals/domain/listing-schema";
import { tradeFormDataToObject } from "@/modules/professionals/domain/trade-forms";
import { listActiveCategories } from "@/modules/professionals/application/professional-service";

const idSchema = z.uuid();

export async function updateListingAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const id = idSchema.parse(form.get("id"));
  const raw = formToObject(form, ["languages", "eventTypes", "secondaryCategoryIds"]);
  raw.priceFromCents = eurosToCents(raw.priceFromEuros);
  raw.priceToCents = eurosToCents(raw.priceToEuros);
  raw.acceptsChildrenServices = raw.acceptsChildrenServices === "on";
  const parsed = listingEditSchema.safeParse(raw);
  if (!parsed.success) return validationResult(parsed.error);
  try {
    const categories = await listActiveCategories();
    const category = categories.find((c) => c.id === parsed.data.primaryCategoryId);
    const trade = category ? tradeFormDataToObject(category.formSchemaKey, form) : null;
    const { reviewOpened } = await updateListing(actor, id, parsed.data, trade);
    revalidatePath(`/app/pro/${id}`, "layout");
    return { ok: true, data: { reviewOpened } };
  } catch (e) {
    return toActionErrorWithFields(e);
  }
}

export async function submitListingAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await submitForReview(actor, idSchema.parse(id));
    revalidatePath(`/app/pro/${id}`, "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function archiveListingAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await getManagedListing(actor, idSchema.parse(id));
    await archiveListing(actor, id);
  } catch (e) {
    return toActionError(e);
  }
  // Outside the try block: redirect() signals through an exception that must not be swallowed.
  redirect("/app/pro");
}
