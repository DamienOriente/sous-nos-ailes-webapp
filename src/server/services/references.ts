import type { Prisma } from "@/lib/db";

/** Allocates the next human-readable reference (LPI-YYYY-NNNN) inside a transaction. */
export async function allocateReference(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  // Row lock on the counter row serialises concurrent allocations.
  await tx.$executeRaw`INSERT INTO "ReferenceCounter" ("year", "next") VALUES (${year}, 1) ON CONFLICT ("year") DO NOTHING`;
  const rows = await tx.$queryRaw<Array<{ next: number }>>`UPDATE "ReferenceCounter" SET "next" = "next" + 1 WHERE "year" = ${year} RETURNING "next" - 1 AS next`;
  const number = rows[0]?.next ?? 1;
  return `LPI-${year}-${String(number).padStart(4, "0")}`;
}
