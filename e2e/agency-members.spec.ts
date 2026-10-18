import { expect, test, type Page } from "@playwright/test";

/** One-click demo sign-in (demo mode only), see e2e/demo-accounts.spec.ts. */
async function signInAs(page: Page, name: RegExp) {
  await page.goto("/connexion?changer=1");
  await page.getByRole("button", { name }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
}

test("le propriétaire d'une agence voit son équipe, invite une personne puis annule l'invitation", async ({ page }) => {
  // Unique address per run: the invitation is cancelled at the end, nothing joins the demo agency.
  const email = `e2e-equipe-${Date.now()}@sousnosailes.test`;
  await signInAs(page, /Claire Morel/);
  await page.goto("/app/pro/structure");

  await expect(page.getByRole("heading", { level: 2, name: "Équipe de Maison Lumière Évènements" })).toBeVisible();
  const members = page.getByRole("table");
  await expect(members.getByRole("row", { name: /Claire Morel/ })).toContainText("Propriétaire");
  await expect(members.getByRole("button", { name: /Retirer Claire Morel/ })).toHaveCount(0);

  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Rôle", { exact: true }).selectOption("admin");
  await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByText("Invitation envoyée par e-mail.").first()).toBeVisible();

  const pending = page.getByRole("listitem").filter({ hasText: email });
  await expect(pending).toContainText("Administrateur");
  await pending.getByRole("button", { name: /Annuler l'invitation/ }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(email);
  await dialog.getByRole("button", { name: "Annuler l'invitation" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: email })).toHaveCount(0);
});

test("un lien d'invitation inconnu est refusé sans rien révéler", async ({ page }) => {
  await signInAs(page, /Claire Morel/);
  await page.goto("/app/pro/structure/invitation/lien-inconnu-0123456789abcdef");
  await expect(page.getByText("Lien d'invitation invalide")).toBeVisible();
});
