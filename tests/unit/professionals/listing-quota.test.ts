import { describe, expect, it } from "vitest";
import { billableExtraListings, canIndependentCreate, countsAgainstQuota, listingSlots, listingsToHold } from "@/modules/professionals/domain/listing-quota";

describe("listing quota", () => {
  it("counts a listing from submission to publication only", () => {
    for (const s of ["pending_review", "changes_requested", "approved", "published", "suspended"]) expect(countsAgainstQuota(s)).toBe(true);
    for (const s of ["draft", "rejected", "archived"]) expect(countsAgainstQuota(s)).toBe(false);
  });

  it("gives independents one slot whatever they pay, agencies one plus the paid extras", () => {
    expect(listingSlots({ isVerifiedAgency: false, paidExtra: 5 })).toBe(1);
    expect(listingSlots({ isVerifiedAgency: true, paidExtra: 0 })).toBe(1);
    expect(listingSlots({ isVerifiedAgency: true, paidExtra: 3 })).toBe(4);
    expect(billableExtraListings(0)).toBe(0);
    expect(billableExtraListings(1)).toBe(0);
    expect(billableExtraListings(4)).toBe(3);
    expect(canIndependentCreate(0)).toBe(true);
    expect(canIndependentCreate(1)).toBe(false);
  });

  it("keeps the primary listing, then the oldest published, and holds the rest", () => {
    const d = (n: number) => new Date(2026, 0, n);
    const listings = [
      { id: "a", status: "published", publishedAt: d(1) },
      { id: "b", status: "published", publishedAt: d(2) },
      { id: "c", status: "pending_review", publishedAt: null },
      { id: "x", status: "draft", publishedAt: null },
    ];
    expect(listingsToHold(listings, 1, null)).toEqual(["b", "c"]);
    expect(listingsToHold(listings, 1, "b")).toEqual(["a", "c"]);
    expect(listingsToHold(listings, 3, null)).toEqual([]);
  });
});
