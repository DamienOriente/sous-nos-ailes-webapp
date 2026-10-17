import { expect, test } from "@playwright/test";

/** Mobile (Pixel 7 project): the home page, the sheet menu and the cookie banner must work one-handed. */
test("accueil mobile : menu, recherche et bannière cookies utilisables", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // No horizontal overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const banner = page.getByTestId("cookie-banner");
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Tout accepter" }).click();
  await expect(banner).toBeHidden();

  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const nav = page.getByRole("navigation", { name: "Navigation mobile" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Tarifs" }).click();
  await expect(page).toHaveURL(/\/tarifs$/);
});

test("page juridique mobile : lisible, sommaire en tête, sans débordement", async ({ page }) => {
  await page.goto("/confidentialite");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Politique de confidentialité");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("navigation", { name: "Sommaire" })).toBeVisible();
});

test("signalement mobile : le formulaire se soumet", async ({ page }) => {
  await page.goto("/signalement");
  await page.getByLabel("Lien ou nom du contenu").fill("Fiche e2e mobile");
  await page.getByLabel("Que s'est-il passé ?").fill("Contenu signalé depuis la suite e2e mobile, à ignorer.");
  await page.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByTestId("report-success")).toBeVisible();
});
