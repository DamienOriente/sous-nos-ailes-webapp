import { expect, test, type Page } from "@playwright/test";

/** One-click demo sign-in (demo mode only), see e2e/demo-accounts.spec.ts. */
async function signInAs(page: Page, name: RegExp) {
  await page.goto("/connexion?changer=1");
  await page.getByRole("button", { name }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
}

test("un indépendant a « Ma fiche pro » et ne peut pas créer une seconde fiche", async ({ page }) => {
  await signInAs(page, /Marie Delcourt/);
  const nav = page.getByRole("navigation").first();
  await expect(page.getByRole("link", { name: "Ma fiche pro" }).first()).toBeVisible();
  await expect(nav.getByRole("link", { name: "Mes fiches pro" })).toHaveCount(0);

  await page.goto("/app/pro");
  await expect(page).toHaveURL(/\/app\/pro\/[0-9a-f-]{36}$/);

  await page.goto("/onboarding/professionnel");
  await expect(page).toHaveURL(/\/app\/pro\/[0-9a-f-]{36}\?limite=1$/);
  await expect(page.getByText("Un compte indépendant a une seule fiche")).toBeVisible();
  await page.getByRole("link", { name: "Ma structure" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Ma structure" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Envoyer la demande" })).toBeVisible();
});

test("une agence validée voit ses fiches, le prix de la suivante et son abonnement", async ({ page }) => {
  await signInAs(page, /Claire Morel/);
  await page.goto("/app/pro");
  await expect(page.getByRole("heading", { level: 1, name: "Mes fiches pro" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Maison Lumière, décoration/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Maison Lumière, location de mobilier/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Maison Lumière, animation/ })).toBeVisible();
  await expect(page.getByText(/Une fiche de plus coûterait 9,90/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajouter une fiche" })).toBeVisible();

  await page.goto("/app/pro/structure");
  await expect(page.getByText("Agence validée").first()).toBeVisible();
  await expect(page.getByText(/29,80/)).toBeVisible();
});

test("la page tarifs présente le barème des agences", async ({ page }) => {
  await page.goto("/tarifs");
  const section = page.locator("#agences");
  await expect(section.getByRole("heading", { name: "Agences et structures à plusieurs activités" })).toBeVisible();
  await expect(section.getByRole("cell", { name: "1re fiche" })).toBeVisible();
  await expect(section.getByRole("cell", { name: "De la 2e à la 3e fiche" })).toBeVisible();
  await expect(section.getByText(/14,90/)).toBeVisible();
  await expect(section.getByRole("cell", { name: "11e fiche et suivantes" })).toBeVisible();
});

test("le modérateur voit la demande d'agence en attente avec ses décisions", async ({ page }) => {
  await signInAs(page, /Modération SNA/);
  await page.goto("/admin/moderation?kind=agency_review");
  const row = page.getByRole("table").getByRole("link", { name: "Structure à valider comme agence" }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("heading", { name: "Structure demandant le statut agence" })).toBeVisible();
  await expect(page.getByText("99900002000019", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Approuver/ }).or(page.getByRole("radio", { name: /Approuver/ })).first()).toBeVisible();
});
