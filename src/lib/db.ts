import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseUrl, getEnv } from "@/lib/env";

export { Prisma } from "@/generated/prisma/client";
export type { PrismaClient } from "@/generated/prisma/client";

// Lazily-created singleton so that importing this module never opens a
// connection at build time. In development the instance survives HMR.
const globalForPrisma = globalThis as unknown as { __lpiPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const env = getEnv();
  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export function getDb(): PrismaClient {
  if (!globalForPrisma.__lpiPrisma) {
    globalForPrisma.__lpiPrisma = createClient();
  }
  return globalForPrisma.__lpiPrisma;
}

/** Ergonomic proxy: `db.user.findMany()` initialises the client on first use. */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getDb();
    const value = Reflect.get(client, property) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

export async function disconnectDb(): Promise<void> {
  if (globalForPrisma.__lpiPrisma) {
    await globalForPrisma.__lpiPrisma.$disconnect();
    globalForPrisma.__lpiPrisma = undefined;
  }
}
