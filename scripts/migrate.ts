import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Standalone migration runner (no Next.js runtime). Used by the migrator container and `pnpm db:migrate`.
async function main() {
  const url = process.env.DATABASE_URL ?? "postgresql://sna:sna@localhost:5450/sna";
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle({ client: pool, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  await pool.end();
  process.stdout.write("migrations applied\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
