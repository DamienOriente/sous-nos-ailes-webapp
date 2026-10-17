import { expect, test } from "@playwright/test";

test("mobile home has no horizontal overflow and the menu works", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(page.getByRole("navigation", { name: "Navigation mobile" }).getByRole("link", { name: "Prestations" })).toBeVisible();
  await page.getByRole("button", { name: "Fermer le menu" }).click();
});

test("mobile request form is usable", async ({ page }) => {
  await page.goto("/demander-un-devis");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Continuer" })).toBeVisible();
});
