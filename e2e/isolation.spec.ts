import { expect, test } from "@playwright/test";
import { DEMO, login, logout } from "./helpers";

test.describe("isolation between accounts", () => {
  test("a client cannot read another client's file", async ({ page }) => {
    await login(page, DEMO.client2, "/espace-client");
    const thomasLink = page.getByRole("link", { name: /LPI-DEMO-0002/ }).first();
    await expect(thomasLink).toBeVisible();
    const href = await thomasLink.getAttribute("href");
    expect(href).toBeTruthy();
    await logout(page);

    await login(page, DEMO.client1, "/espace-client");
    await expect(page.getByText("LPI-DEMO-0002")).toHaveCount(0);
    const response = await page.goto(href!);
    expect(response?.status()).toBe(404);
  });

  test("a provider cannot open a mission they were not invited to", async ({ page }) => {
    await login(page, DEMO.providerDorian, "/espace-intervenant");
    const missionLink = page.getByRole("link", { name: /LPI-DEMO-0004|Voir la mission|Détails/ }).first();
    await expect(missionLink).toBeVisible();
    const href = await missionLink.getAttribute("href");
    expect(href).toMatch(/\/espace-intervenant\/missions\//);
    await logout(page);

    await login(page, DEMO.providerChloe, "/espace-intervenant");
    const response = await page.goto(href!);
    expect(response?.status()).toBe(404);
  });

  test("a partner sees aggregated figures only, never client identities", async ({ page }) => {
    await login(page, DEMO.partner, "/espace-partenaire");
    const text = await page.locator("main").innerText();
    expect(text).toContain("Demandes apportées");
    expect(text).not.toMatch(/Camille|Durand|Thomas|Lefèvre|camille\.durand|thomas\.lefevre/);
  });

  test("private spaces redirect anonymous visitors to the login page", async ({ page }) => {
    for (const path of ["/admin", "/espace-client", "/espace-intervenant", "/espace-partenaire"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/connexion\?next=/);
    }
  });

  test("a client account cannot enter the administration", async ({ page }) => {
    await login(page, DEMO.client1, "/espace-client");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/espace-client/);
  });
});
