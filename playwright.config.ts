import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3200";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /.*\.mobile\.spec\.ts/ },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "pnpm start",
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
