import { db, pool } from "@/db/client";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { seedDemoUsers, seedReferenceData } from "./core";
import type { SeedContext } from "./context";

/**
 * Seed entry point. Reference data is always safe; demo data only when
 * DEMO_MODE=true (never in production).
 */
async function main() {
  if (env.APP_ENV === "production" && env.DEMO_MODE) throw new Error("demo seed refused in production");
  const ctx: SeedContext = { db, now: new Date(), users: {}, categories: {}, plans: {}, professionals: {}, events: {}, members: {} };

  await seedReferenceData(ctx);
  process.stdout.write(`reference data: ${Object.keys(ctx.categories).length} categories, ${Object.keys(ctx.plans).length} plans\n`);

  if (env.DEMO_MODE) {
    await seedDemoUsers(ctx);
    process.stdout.write(`demo users: ${Object.keys(ctx.users).length}\n`);
    // Module seeds are registered here (order matters: professionals before events).
    const modules = await loadModuleSeeds();
    for (const m of modules) {
      await m.run(ctx);
      process.stdout.write(`seeded: ${m.name}\n`);
    }
  }
  await pool.end();
  await redis.quit().catch(() => undefined);
}

type ModuleSeed = { name: string; run: (ctx: SeedContext) => Promise<void> };

async function loadModuleSeeds(): Promise<ModuleSeed[]> {
  const seeds: ModuleSeed[] = [];
  const candidates: Array<{ name: string; path: string }> = [
    { name: "professionals", path: "./professionals" },
    { name: "agencies", path: "./agencies" },
    { name: "pages", path: "./pages" },
    { name: "events", path: "./events" },
    { name: "briefs", path: "./briefs" },
    { name: "guests", path: "./guests" },
    { name: "children", path: "./children" },
    { name: "collaboration", path: "./collaboration" },
    { name: "calendar", path: "./calendar" },
    { name: "billing", path: "./billing" },
    { name: "files", path: "./files" },
    { name: "admin", path: "./admin" },
    { name: "legal", path: "./legal" },
  ];
  for (const c of candidates) {
    try {
      const mod = (await import(c.path)) as { seed?: (ctx: SeedContext) => Promise<void> };
      if (typeof mod.seed === "function") seeds.push({ name: c.name, run: mod.seed });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "ERR_MODULE_NOT_FOUND" && !String(err).includes("Cannot find module")) throw err;
    }
  }
  return seeds;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
