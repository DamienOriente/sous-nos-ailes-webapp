// Captures full-page screenshots of public (and optionally private) pages at
// desktop (1440) and mobile (390) widths into .impeccable/review/.
// Usage: pnpm tsx scripts/capture-review.ts [--private]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const OUT = path.resolve(".impeccable/review");
fs.mkdirSync(OUT, { recursive: true });

const PUBLIC_PAGES: Array<[string, string]> = [
  ["home", "/"],
  ["prestations", "/prestations"],
  ["mariages", "/mariages"],
  ["evenements", "/evenements"],
  ["a-propos", "/a-propos"],
  ["organisation", "/organisation"],
  ["lieux", "/lieux"],
  ["lieu-detail", "/lieux/domaine-des-tilleuls"],
  ["faq", "/faq"],
  ["devis", "/demander-un-devis"],
  ["devenir-partenaire", "/devenir-partenaire"],
  ["rejoindre", "/rejoindre-le-reseau"],
  ["contact", "/contact"],
  ["confidentialite", "/confidentialite"],
  ["connexion", "/connexion"],
  ["404", "/page-inexistante"],
];

const PRIVATE: Array<{ name: string; email: string; password: string; pages: Array<[string, string]> }> = [
  { name: "admin", email: "marie@example.test", password: "demo-marie-2026", pages: [["admin-dashboard", "/admin"], ["admin-evenements", "/admin/evenements"], ["admin-planning", "/admin/planning"], ["admin-intervenants", "/admin/intervenants"], ["admin-lieux", "/admin/lieux"], ["admin-candidatures", "/admin/candidatures"], ["admin-parametres", "/admin/parametres"], ["admin-contenus", "/admin/contenus"]] },
  { name: "client", email: "camille.durand@example.test", password: "demo-client-2026", pages: [["client-home", "/espace-client"]] },
  { name: "provider", email: "alix.moreau@example.test", password: "demo-intervenant-2026", pages: [["provider-home", "/espace-intervenant"], ["provider-dispos", "/espace-intervenant/disponibilites"], ["provider-profil", "/espace-intervenant/profil"]] },
  { name: "partner", email: "contact@domaine-des-tilleuls.example.test", password: "demo-partenaire-2026", pages: [["partner-home", "/espace-partenaire"]] },
];

async function capture(pageWidth: number, suffix: string, includePrivate: boolean) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: pageWidth, height: pageWidth > 600 ? 900 : 844 }, locale: "fr-FR", timezoneId: "Europe/Paris", reducedMotion: "reduce" });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const settle = () => page.waitForTimeout(700);
  for (const [name, route] of PUBLIC_PAGES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 60_000 });
    await settle();
    await page.screenshot({ path: path.join(OUT, `${name}-${suffix}.png`), fullPage: true });
  }
  if (includePrivate) {
    for (const account of PRIVATE) {
      await page.goto(`${BASE}/connexion`, { waitUntil: "load", timeout: 60_000 });
      await page.getByLabel("Adresse email").last().fill(account.email);
      await page.getByLabel("Mot de passe").fill(account.password);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
      for (const [name, route] of account.pages) {
        await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 60_000 });
        await settle();
        await page.screenshot({ path: path.join(OUT, `${name}-${suffix}.png`), fullPage: true });
      }
      // First event detail for admin/client/provider when a link exists
      if (account.name === "admin") {
        await page.goto(`${BASE}/admin/evenements`, { waitUntil: "load", timeout: 60_000 });
        const link = page.getByRole("link", { name: /LPI-DEMO-0003/ }).first();
        if (await link.count()) {
          await link.click();
          await page.waitForURL(/\/admin\/evenements\/[^/?]+$/);
          await page.waitForLoadState("load");
          await page.screenshot({ path: path.join(OUT, `admin-event-${suffix}.png`), fullPage: true });
        }
      }
      if (account.name === "client") {
        await page.goto(`${BASE}/espace-client`, { waitUntil: "load", timeout: 60_000 });
        const link = page.getByRole("link", { name: /LPI-DEMO-0003/ }).first();
        if (await link.count()) {
          await link.click();
          await page.waitForURL(/\/espace-client\/evenements\/[^/?]+$/);
          await page.waitForLoadState("load");
          await page.screenshot({ path: path.join(OUT, `client-event-${suffix}.png`), fullPage: true });
        }
      }
      await page.getByRole("button", { name: "Se déconnecter" }).click();
      await page.waitForURL(`${BASE}/`);
    }
  }
  await browser.close();
}

const includePrivate = process.argv.includes("--private");
await capture(1440, "desktop", includePrivate);
await capture(390, "mobile", includePrivate);
// Canonical names expected by the finish reviewer
fs.copyFileSync(path.join(OUT, "home-desktop.png"), path.join(OUT, "desktop.png"));
fs.copyFileSync(path.join(OUT, "home-mobile.png"), path.join(OUT, "mobile.png"));
console.log(`captured into ${OUT} (${fs.readdirSync(OUT).length} files)`);
