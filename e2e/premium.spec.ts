import { expect, test } from "@playwright/test";
import { login } from "./_auth";

test.describe("Premium subscription (mock provider)", () => {
  test("paul hits the paywall, subscribes, cancels at period end and keeps access", async ({ page }) => {
    await login(page, "paul@sousnosailes.test");

    // Entry point of the paywall: the feature is highlighted.
    await page.goto("/app/compte/abonnement?feature=seating_plan");
    await expect(page.getByTestId("feature-highlight")).toContainText("Plan de table");
    await expect(page.getByTestId("current-plan")).toContainText("Organisateur Gratuit");
    await expect(page.locator("tr[data-feature='seating_plan']")).toContainText("Ce qui vous intéresse");

    // Subscribe → mock checkout (clearly labelled) → simulated success.
    await page.locator("[data-plan='organizer_plus']").getByRole("button", { name: /Souscrire/ }).click();
    await expect(page).toHaveURL(/\/app\/compte\/abonnement\/mock-checkout\?/);
    await expect(page.getByTestId("mock-checkout")).toContainText("Paiement simulé");
    await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();

    // Return page polls the real entitlement.
    await expect(page).toHaveURL(/\/app\/compte\/abonnement\/retour\?/);
    await expect(page.getByTestId("checkout-confirmed")).toContainText("Organisateur Plus", { timeout: 20_000 });

    // Plan is now active; the premium tool page (if delivered) no longer shows the paywall.
    await page.goto("/app/compte/abonnement");
    await expect(page.getByTestId("current-plan")).toContainText("Organisateur Plus");
    await expect(page.getByTestId("subscription-card")).toContainText("Actif");

    // Cancel at period end → access kept until the date.
    await page.getByRole("button", { name: "Résilier à l'échéance" }).click();
    await expect(page.getByTestId("cancel-notice")).toContainText("restent disponibles jusqu'au", { timeout: 15_000 });
    await expect(page.getByTestId("subscription-card")).toContainText("Actif jusqu'au");
    await expect(page.getByTestId("current-plan")).toContainText("Organisateur Plus");

    // Simulate the end of period (what customer.subscription.deleted does) so the demo account is back on the free plan.
    await page.getByRole("button", { name: "Simuler la fin de période" }).click();
    await expect(page.getByTestId("current-plan")).toContainText("Organisateur Gratuit", { timeout: 15_000 });
  });

  test("pricing page explains billing and shows the non-live banner", async ({ page }) => {
    await page.goto("/tarifs");
    await expect(page.getByRole("heading", { name: "Une offre claire, sans engagement" })).toBeVisible();
    await expect(page.getByText("Paiement réel non activé sur cet environnement.")).toBeVisible();
    await page.getByRole("button", { name: "Comment annuler ?" }).click();
    await expect(page.getByText(/deux clics/)).toBeVisible();
    await expect(page.getByText(/sécurisé par Stripe/).first()).toBeVisible();
  });
});

test("a professional sees the Premium plan of her listing", async ({ page }) => {
  await login(page, "camille.planner@sousnosailes.test");
  await page.goto("/app/compte/abonnement?audience=professional&feature=stats");
  await page.getByRole("link", { name: "Gérer l'abonnement de cette fiche" }).first().click();
  await expect(page).toHaveURL(/\/app\/pro\/[0-9a-f-]+\/abonnement\?feature=stats/);
  await expect(page.getByTestId("current-plan")).toContainText("Professionnel Premium");
  await expect(page.getByTestId("feature-highlight")).toContainText("Statistiques");
  await expect(page.getByTestId("subscription-card")).toContainText("Paiement simulé");
});
