import { redirect } from "next/navigation";
import { agencyPaymentDetails, ListingLimitError } from "@/modules/professionals/application/listing-slot";

/**
 * Turns quota/billing errors raised while creating or submitting a listing into navigation:
 * an independent's second listing goes back to the existing one, an agency's extra listing
 * goes to the page that shows the price and asks for payment or confirmation.
 * Any other error returns so the caller maps it as usual.
 */
export function redirectOnListingQuota(e: unknown, professionalId?: string): void {
  if (e instanceof ListingLimitError) redirect(`/app/pro/${e.existingListingId}?limite=1`);
  if (professionalId && agencyPaymentDetails(e)) redirect(`/app/pro/${professionalId}/ajout-agence`);
}
