import { existsSync } from "node:fs";
import { z } from "zod";

// Scripts and workers run under tsx, which does not load .env (Next does).
// loadEnvFile never overrides variables already present in the environment.
if (!process.env.NEXT_RUNTIME && process.env.SKIP_DOTENV !== "1" && existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ignore: a malformed .env is reported by the schema validation below
  }
}

/**
 * Runtime environment, validated once at startup. Importing this module from a
 * client component is a build error (server-only).
 */
const booleanish = z
  .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0"), z.boolean()])
  .transform((v) => v === true || v === "true" || v === "1");

const schema = z
  .object({
    APP_ENV: z.enum(["local", "test", "production", "build"]).default("local"),
    DEMO_MODE: booleanish.default(false),
    INDEXING_ENABLED: booleanish.default(false),
    APP_URL: z.url().default("http://localhost:3200"),
    DEFAULT_TIMEZONE: z.string().default("Europe/Paris"),

    DATABASE_URL: z.string().min(1).default("postgresql://sna:sna@localhost:5450/sna"),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    REDIS_URL: z.string().min(1).default("redis://localhost:6390"),

    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    DATA_ENCRYPTION_KEY: z.string().min(32).optional(),

    SMTP_HOST: z.string().default("localhost"),
    SMTP_PORT: z.coerce.number().int().default(1027),
    SMTP_SECURE: booleanish.default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default("Sous Nos Ailes <no-reply@sousnosailes.test>"),

    S3_ENDPOINT: z.string().default("http://localhost:9010"),
    S3_REGION: z.string().default("fr-par"),
    S3_BUCKET: z.string().default("sna-files"),
    S3_QUARANTINE_BUCKET: z.string().default("sna-quarantine"),
    S3_ACCESS_KEY: z.string().default("sna-minio"),
    S3_SECRET_KEY: z.string().default("sna-minio-local-only"),
    S3_FORCE_PATH_STYLE: booleanish.default(true),

    CLAMAV_ENABLED: booleanish.default(true),
    CLAMAV_HOST: z.string().default("localhost"),
    CLAMAV_PORT: z.coerce.number().int().default(3310),

    STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
    STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_CLIENT_ID: z.string().optional(),
    MICROSOFT_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_TENANT: z.string().default("common"),

    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
    /** Force production-grade auth rate limits outside production (used to test the 429 path). */
    AUTH_RATE_LIMIT_STRICT: booleanish.default(false),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === "production") {
      if (env.DEMO_MODE) {
        ctx.addIssue({ code: "custom", path: ["DEMO_MODE"], message: "DEMO_MODE must be false in production" });
      }
      if (!env.BETTER_AUTH_SECRET) {
        ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_SECRET"], message: "required in production" });
      }
      if (!env.DATA_ENCRYPTION_KEY) {
        ctx.addIssue({ code: "custom", path: ["DATA_ENCRYPTION_KEY"], message: "required in production" });
      }
      if (!env.APP_URL.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "must be https in production" });
      }
      if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) {
        ctx.addIssue({ code: "custom", path: ["STRIPE_WEBHOOK_SECRET"], message: "required when Stripe is enabled" });
      }
    }
  });

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export const env: Env = load();

export const isProduction = env.APP_ENV === "production";
export const isDemo = env.DEMO_MODE && !isProduction;
/** Stripe runs for real only when a key is configured; otherwise a clearly labelled mock. */
export const stripeConfigured = Boolean(env.STRIPE_SECRET_KEY);
export const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const microsoftConfigured = Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
