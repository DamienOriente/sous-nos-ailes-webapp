"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { startAgencyCheckout } from "@/modules/billing/application/agency-billing";
import { agencyPaymentDetails } from "@/modules/professionals/application/listing-slot";
import { getManagedListing, submitForReview } from "@/modules/professionals/application/professional-service";

const idSchema = z.uuid();

/** No agency subscription yet: opens checkout for the quantity this listing requires. */
export async function payAgencyAction(professionalId: string): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const id = idSchema.parse(professionalId);
    const { listing } = await getManagedListing(actor, id);
    if (!listing.organizationId) throw new ValidationError("Cette fiche n'est pas rattachée à une agence.");
    try {
      await submitForReview(actor, id);
    } catch (e) {
      const details = agencyPaymentDetails(e);
      if (!details) throw e;
      const res = await startAgencyCheckout(actor, { organizationId: details.organizationId, quantity: details.quantity, professionalId: id });
      return { ok: true, data: { redirectTo: res.url } };
    }
    // The slot was already paid (e.g. after a checkout completed in another tab).
    revalidatePath(`/app/pro/${id}`, "layout");
    return { ok: true, data: { redirectTo: `/app/pro/${id}?submitted=1` } };
  } catch (e) {
    return toActionError(e);
  }
}

/** Agency subscription active: the user confirmed the extra monthly amount shown on the page. */
export async function confirmExtraListingAction(professionalId: string): Promise<ActionResult<never>> {
  let id: string;
  try {
    const actor = await requireActorOrThrow();
    id = idSchema.parse(professionalId);
    await submitForReview(actor, id, { confirmExtraCharge: true });
    revalidatePath(`/app/pro/${id}`, "layout");
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/app/pro/${id}?submitted=1`);
}
