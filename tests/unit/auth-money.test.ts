import { afterEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { formatEuros, parseEurosToCents } from "@/lib/money";
import { getEnv, resetEnvCacheForTests } from "@/lib/env";
import { rateLimit, resetRateLimitsForTests } from "@/lib/rate-limit";

describe("password hashing", () => {
  it("round-trips and rejects wrong passwords", async () => {
    const hash = await hashPassword("demo-marie-2026");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("demo-marie-2026", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("money", () => {
  it("parses and formats euros", () => {
    expect(parseEurosToCents("35")).toBe(3500);
    expect(parseEurosToCents("35,50")).toBe(3550);
    expect(parseEurosToCents("1 250,00 €")).toBe(125_000);
    expect(parseEurosToCents("abc")).toBeNull();
    expect(formatEuros(3550).replace(/ | /g, " ")).toBe("35,50 €");
  });
});

describe("environment guards", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    resetEnvCacheForTests();
  });

  it("refuses demo mode in production", () => {
    process.env.APP_ENV = "production";
    process.env.DEMO_MODE = "true";
    process.env.DATABASE_URL = "postgresql://x";
    resetEnvCacheForTests();
    expect(() => getEnv()).toThrow(/DEMO_MODE/);
  });

  it("defaults to demo mode locally and indexing off", () => {
    process.env.APP_ENV = "local";
    delete process.env.DEMO_MODE;
    delete process.env.INDEXING_ENABLED;
    process.env.DATABASE_URL = "postgresql://x";
    resetEnvCacheForTests();
    const env = getEnv();
    expect(env.DEMO_MODE).toBe(true);
    expect(env.INDEXING_ENABLED).toBe(false);
  });
});

describe("rate limiter", () => {
  afterEach(() => resetRateLimitsForTests());
  it("blocks after the limit within the window", () => {
    for (let i = 0; i < 3; i += 1) expect(rateLimit({ key: "k", limit: 3, windowMs: 60_000 }).ok).toBe(true);
    const blocked = rateLimit({ key: "k", limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
  });
});
