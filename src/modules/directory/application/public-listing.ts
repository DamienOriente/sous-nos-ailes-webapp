import { and, eq, isNull, type SQL } from "drizzle-orm";
import { professionals } from "@/db/schema";

/**
 * The one definition of "visible to the public": published, not deleted, and not held
 * because its agency stopped paying for it. Every public query uses it so a new page
 * cannot forget the billing hold.
 */
export function isPublicListing(): SQL {
  return and(eq(professionals.status, "published"), isNull(professionals.deletedAt), isNull(professionals.billingHoldAt)) as SQL;
}

export function isListingRowPublic(row: { status: string; deletedAt: Date | null; billingHoldAt: Date | null }): boolean {
  return row.status === "published" && !row.deletedAt && !row.billingHoldAt;
}
