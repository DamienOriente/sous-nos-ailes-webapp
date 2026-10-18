import { eq } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionals } from "@/db/schema";
import { AppError, ForbiddenError, isAppError } from "@/lib/errors";
import { getAgencyState, loadAgencyPlan } from "@/modules/billing/application/agency-holds";
import { syncAgencyQuantity } from "@/modules/billing/application/agency-billing";
import { amountForQuantity, nextUnitPrice } from "@/modules/billing/domain/tiered-pricing";
import { billableExtraListings, countsAgainstQuota } from "@/modules/professionals/domain/listing-quota";

/** Thrown when an independent tries to run a second listing; carries the existing one. */
export class ListingLimitError extends AppError {
  constructor(readonly existingListingId: string) {
    super("conflict", "Un compte indépendant a une seule fiche professionnelle. Pour en gérer plusieurs, faites valider votre structure comme agence.", { existingListingId });
  }
}

export const AGENCY_OWNER_BILLING_MESSAGE = "Cette fiche s'ajoute à l'abonnement agence : seul le propriétaire de l'agence peut l'envoyer à la relecture.";

export type SubmitOptions = { confirmExtraCharge?: boolean };

export type AgencyPaymentDetails = { reason: "agency_subscription_required" | "agency_extra_confirmation"; organizationId: string; quantity: number; monthlyCents: number; addedCents: number };

/** Payment details carried by a `payment_required` error raised by `assertListingSlot`, if any. */
export function agencyPaymentDetails(e: unknown): AgencyPaymentDetails | null {
  if (!isAppError(e) || e.code !== "payment_required" || !e.details) return null;
  const r = e.details.reason;
  return r === "agency_subscription_required" || r === "agency_extra_confirmation" ? (e.details as unknown as AgencyPaymentDetails) : null;
}

/**
 * Slot check before a listing enters review (listing form, page builder, onboarding).
 * A verified agency pays listings beyond the first: without an active agency subscription
 * the caller is sent to checkout; with one, the extra monthly amount must be confirmed
 * before the quantity grows. A non-agency structure never gets a second counted listing.
 * Billing stays with the agency owner: a member may send a listing whose slot is already
 * paid, never one that would open or grow the subscription.
 */
export async function assertListingSlot(actorUserId: string, listing: { id: string; status: string; organizationId: string | null }, opts: SubmitOptions, executor: DbExecutor = db): Promise<void> {
  if (!listing.organizationId || countsAgainstQuota(listing.status)) return;
  const state = await getAgencyState(listing.organizationId, executor);
  if (!state) return;
  if (!state.isVerifiedAgency) {
    const other = state.listings.find((l) => l.id !== listing.id && countsAgainstQuota(l.status));
    if (other) throw new ListingLimitError(other.id);
    return;
  }
  const needed = billableExtraListings(state.countedListings + 1);
  if (needed <= state.paidExtra) return;
  if (state.organization.ownerUserId !== actorUserId) throw new ForbiddenError(AGENCY_OWNER_BILLING_MESSAGE);
  const tiers = (await loadAgencyPlan(executor))?.tiers ?? [];
  const details: AgencyPaymentDetails = {
    reason: state.subscriptionGrantsAccess ? "agency_extra_confirmation" : "agency_subscription_required",
    organizationId: listing.organizationId,
    quantity: needed,
    monthlyCents: amountForQuantity(tiers, needed),
    addedCents: nextUnitPrice(tiers, needed - 1),
  };
  if (!state.subscriptionGrantsAccess) throw new AppError("payment_required", "Cette fiche s'ajoute à votre abonnement agence : réglez-le pour l'envoyer à la relecture.", details);
  if (!opts.confirmExtraCharge) throw new AppError("payment_required", "Confirmez l'ajout de cette fiche à votre abonnement agence.", details);
}

/** After a listing changed state outside the listing service (page builder): billed quantity follows. */
export async function syncListingAgency(professionalId: string): Promise<void> {
  const [row] = await db.select({ organizationId: professionals.organizationId }).from(professionals).where(eq(professionals.id, professionalId)).limit(1);
  if (row?.organizationId) await syncAgencyQuantity(row.organizationId);
}
