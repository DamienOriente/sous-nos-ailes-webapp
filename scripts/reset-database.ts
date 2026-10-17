import { Pool } from "pg";

/** Drops and recreates the public schema, then re-applies migrations. Local/test only. */
async function main() {
  if (process.env.APP_ENV === "production") throw new Error("refusing to reset a production database");
  const url = process.env.DATABASE_URL ?? "postgresql://sna:sna@localhost:5450/sna";
  const pool = new Pool({ connectionString: url, max: 1 });
  await pool.query("drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade;");
  await pool.end();
  process.stdout.write("database reset\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
