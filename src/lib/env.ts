import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";

// Runtime configuration. Parsed lazily so that `next build` never needs a
// database or secrets, and so the seed script (tsx) can reuse it.

const booleanish = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off", ""].includes(normalized)) return false;
  return value;
}, z.boolean().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "production"]).default("local"),
  DEMO_MODE: booleanish,
  INDEXING_ENABLED: booleanish,
  APP_URL: z.url().default("http://localhost:3100"),
  // Only required when a database client is created (see getDatabaseUrl), so that `next build` needs no database.
  DATABASE_URL: z.string().min(1).optional(),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1026),
  MAIL_FROM: z.string().default("Les Petits Invités <no-reply@example.test>"),
  SESSION_SECRET: z.string().min(32).optional(),
  SECRETS_DIR: z.string().default(".secrets"),
});

export type AppEnv = Omit<z.infer<typeof envSchema>, "DEMO_MODE" | "INDEXING_ENABLED"> & {
  DEMO_MODE: boolean;
  INDEXING_ENABLED: boolean;
  isProduction: boolean;
};

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    throw new Error(
      `Invalid environment configuration: ${JSON.stringify(flat.fieldErrors)}`,
    );
  }
  const raw = parsed.data;
  const isProduction = raw.APP_ENV === "production";
  const demoMode = raw.DEMO_MODE ?? !isProduction;
  if (isProduction && demoMode) {
    // Hard stop: demo accounts and fictitious data must never run in production.
    throw new Error(
      "DEMO_MODE=true is refused when APP_ENV=production. Disable demo mode or run with APP_ENV=local.",
    );
  }
  cached = {
    ...raw,
    DEMO_MODE: demoMode,
    INDEXING_ENABLED: raw.INDEXING_ENABLED ?? false,
    isProduction,
  };
  return cached;
}

/** Database URL, required at runtime (client creation, seed, reset) but never at build time. */
export function getDatabaseUrl(): string {
  const url = getEnv().DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to connect to PostgreSQL (see .env.example).");
  return url;
}

let sessionSecretCache: string | null = null;

/**
 * Returns the session signing secret. In local mode a random key is generated
 * on first use and persisted to `<SECRETS_DIR>/session.key` with mode 600.
 * Production requires SESSION_SECRET to be provided explicitly.
 */
export function getSessionSecret(): string {
  if (sessionSecretCache) return sessionSecretCache;
  const env = getEnv();
  if (env.SESSION_SECRET) {
    sessionSecretCache = env.SESSION_SECRET;
    return sessionSecretCache;
  }
  const dir = path.resolve(process.cwd(), env.SECRETS_DIR);
  const file = path.join(dir, "session.key");
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8").trim();
    if (content.length >= 32) {
      sessionSecretCache = content;
      return content;
    }
  }
  if (env.isProduction) {
    throw new Error("SESSION_SECRET is required in production.");
  }
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const generated = randomBytes(32).toString("hex");
  fs.writeFileSync(file, generated, { mode: 0o600 });
  sessionSecretCache = generated;
  return generated;
}

/** Test helper: forget the cached environment (used by unit tests). */
export function resetEnvCacheForTests(): void {
  cached = null;
  sessionSecretCache = null;
}
