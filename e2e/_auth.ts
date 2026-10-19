import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, type BrowserContext, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "Demo-SousNosAiles-2026!";
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3200";

type Cookie = Awaited<ReturnType<BrowserContext["cookies"]>>[number];
const AUTH_DIR = path.join(process.cwd(), "e2e", ".auth");
const MAX_AGE_MS = 60 * 60 * 1000;

function cacheFile(email: string): string {
  return path.join(AUTH_DIR, `${email.replace(/[^a-z0-9]/gi, "_")}.json`);
}

function readCache(email: string): Cookie[] | null {
  const file = cacheFile(email);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { at: number; cookies: Cookie[] };
    if (Date.now() - parsed.at > MAX_AGE_MS) return null;
    return parsed.cookies;
  } catch {
    return null;
  }
}

/**
 * Signs in through better-auth's API (independent of the login UI). The
 * session cookies are cached on disk (e2e/.auth, one hour) so the whole run
 * signs in at most once per account: the sign-in endpoint is rate limited
 * (5/min per IP) and other suites may run at the same time.
 */
export async function login(page: Page, email: string): Promise<void> {
  const cached = readCache(email);
  if (cached) {
    await page.context().addCookies(cached);
    const check = await page.request.get(`${BASE_URL}/api/auth/get-session`);
    if (check.ok() && (await check.text()) !== "null") return;
    await page.context().clearCookies();
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await page.request.post(`${BASE_URL}/api/auth/sign-in/email`, { data: { email, password: DEMO_PASSWORD }, headers: { origin: BASE_URL } });
    if (res.ok()) {
      mkdirSync(AUTH_DIR, { recursive: true });
      writeFileSync(cacheFile(email), JSON.stringify({ at: Date.now(), cookies: await page.context().cookies() }));
      return;
    }
    if (res.status() !== 429) throw new Error(`login ${email} failed: ${res.status()} ${await res.text()}`);
    await page.waitForTimeout(12_000);
  }
  expect(false, `login ${email}: rate limited after retries`).toBeTruthy();
}
