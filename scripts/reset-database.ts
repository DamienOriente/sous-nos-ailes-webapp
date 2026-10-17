// DESTRUCTIVE: empties every table, then re-runs the seed.
// Usage: pnpm db:reset -- --yes   (or CONFIRM_RESET=yes pnpm db:reset)
import "dotenv/config";
import { execSync } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseUrl, getEnv } from "../src/lib/env";

const env = getEnv();
if (env.isProduction) {
  console.error("Refusing to reset a production database.");
  process.exit(1);
}
const confirmed = process.argv.includes("--yes") || process.env.CONFIRM_RESET === "yes";
if (!confirmed) {
  console.error("This command DELETES ALL DATA. Re-run with --yes (or CONFIRM_RESET=yes) to confirm.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });

async function main() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  if (list) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  console.log(`[reset] ${tables.length} tables emptied`);
  await prisma.$disconnect();
  execSync("pnpm tsx prisma/seed.ts", { stdio: "inherit" });
}

main().catch((error) => {
  console.error("[reset] failed", error);
  process.exit(1);
});
