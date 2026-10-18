/**
 * How many listings an account may run (decision 2026-10-18):
 * - an independent (any account without a verified agency) runs exactly one listing;
 * - a verified agency runs one included listing plus as many as its agency subscription pays for.
 * A listing occupies a slot from submission to publication; drafts, refusals and archives do not.
 */
export const INCLUDED_LISTINGS = 1;

const COUNTED_STATUSES = new Set(["pending_review", "changes_requested", "approved", "published", "suspended"]);

export function countsAgainstQuota(status: string): boolean {
  return COUNTED_STATUSES.has(status);
}

/** Billed units of the agency plan for a number of counted listings (the first one is included). */
export function billableExtraListings(countedListings: number): number {
  return Math.max(0, countedListings - INCLUDED_LISTINGS);
}

/** Total listing slots: independents always 1; agencies 1 + paid extras (0 when the subscription grants no access). */
export function listingSlots(input: { isVerifiedAgency: boolean; paidExtra: number }): number {
  return input.isVerifiedAgency ? INCLUDED_LISTINGS + Math.max(0, input.paidExtra) : INCLUDED_LISTINGS;
}

/** An independent may hold a single listing in any non-deleted state (draft included). */
export function canIndependentCreate(existingListings: number): boolean {
  return existingListings === 0;
}

/**
 * Which listings stay public when only `slots` are paid: the primary one first (if published),
 * then the oldest published. Returns the ids to put on hold.
 */
export function listingsToHold(
  listings: readonly { id: string; status: string; publishedAt: Date | null }[],
  slots: number,
  primaryListingId: string | null,
): string[] {
  const counted = listings.filter((l) => countsAgainstQuota(l.status));
  const ordered = [...counted].sort((a, b) => {
    if (a.id === primaryListingId) return -1;
    if (b.id === primaryListingId) return 1;
    const pa = a.status === "published" ? 0 : 1;
    const pb = b.status === "published" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.publishedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.publishedAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
  });
  return ordered.slice(Math.max(0, slots)).map((l) => l.id);
}
