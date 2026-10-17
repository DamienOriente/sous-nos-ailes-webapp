"use server";

import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/server/authz";
import { updateSettings, upsertOption } from "@/server/services/settings";
import { optionSchema, settingsSchema } from "@/validation/admin";
import { formDataToObject } from "@/validation/common";
import { type FormState, actionMessageFor, eurosToCentsFields, formErrorState, formSuccessState, percentToBps, validationErrorState } from "@/server/actions/admin/helpers";

const SETTINGS_MONEY_FIELDS = ["hourlyRateCents", "minimumAmountCents", "defaultTravelFeeCents"];

/** Money arrives in euros and the VAT rate in percent; both are converted before validation. */
export async function updateSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireActionUser(["ADMIN"]);
    const { data, fieldErrors } = eurosToCentsFields(formDataToObject(formData), SETTINGS_MONEY_FIELDS);
    const vatRateBps = percentToBps(data.vatRatePercent);
    if (vatRateBps === null) fieldErrors.vatRatePercent = ["Taux invalide (exemple : 20)."];
    if (Object.keys(fieldErrors).length) return formErrorState("Vérifiez les champs du formulaire.", formData, fieldErrors);
    const parsed = settingsSchema.safeParse({ ...data, vatRateBps });
    if (!parsed.success) return validationErrorState(parsed.error, formData);
    await updateSettings(parsed.data);
    revalidatePath("/admin/parametres");
    revalidatePath("/", "layout");
    return formSuccessState("Paramètres enregistrés.");
  } catch (error) {
    return formErrorState(actionMessageFor(error), formData);
  }
}

export async function upsertOptionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireActionUser(["ADMIN"]);
    const { data, fieldErrors } = eurosToCentsFields(formDataToObject(formData), ["priceCents"]);
    if (Object.keys(fieldErrors).length) return formErrorState("Vérifiez les champs du formulaire.", formData, fieldErrors);
    const parsed = optionSchema.safeParse(data);
    if (!parsed.success) return validationErrorState(parsed.error, formData);
    const option = await upsertOption(parsed.data);
    revalidatePath("/admin/parametres");
    revalidatePath("/", "layout");
    return formSuccessState(parsed.data.id ? `Option « ${option.label} » mise à jour.` : `Option « ${option.label} » créée.`);
  } catch (error) {
    return formErrorState(actionMessageFor(error), formData);
  }
}
