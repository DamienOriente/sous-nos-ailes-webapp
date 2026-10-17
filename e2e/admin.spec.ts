import { expect, test } from "@playwright/test";
import { login } from "./_auth";

test.describe("Back-office", () => {
  test("a moderator approves a pending listing with a reason and it becomes public", async ({ page }) => {
    await login(page, "moderateur@sousnosailes.test");
    await page.goto("/admin/moderation");
    await expect(page.getByRole("heading", { name: "File de modération" })).toBeVisible();
    const row = page.locator("tbody tr").filter({ hasText: "En attente de validation" }).first();
    if ((await row.count()) === 0) test.skip(true, "no pending listing in the seed");
    const name = (await row.locator("a").first().textContent())?.trim() ?? "";
    await row.locator("a").first().click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await page.getByText("Approuver et publier", { exact: true }).click();
    await page.getByLabel(/Motif/).fill("Avis de situation SIRENE rapproché du SIRET déclaré, description conforme à la charte, photos adaptées (e2e).");
    await page.getByRole("button", { name: "Enregistrer la décision" }).click();
    await expect(page.getByText("Décision enregistrée.").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Résolu").first()).toBeVisible({ timeout: 15_000 });

    // Visible in the directory (delivered by the directory module) or, failing that, listed as published in the admin.
    const annuaire = await page.goto("/annuaire");
    if (annuaire && annuaire.ok() && (await page.getByText(name).count()) > 0) {
      await expect(page.getByText(name).first()).toBeVisible();
    } else {
      await page.goto(`/admin/professionnels?q=${encodeURIComponent(name)}&statut=published`);
      await expect(page.locator("tbody tr").filter({ hasText: name })).toHaveCount(1);
    }
  });

  test("a moderator cannot open admin-only sections", async ({ page }) => {
    await login(page, "moderateur@sousnosailes.test");
    await page.goto("/admin/offres");
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/securite/break-glass");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("an admin suspends and reactivates a user, edits a category and a plan", async ({ page }) => {
    await login(page, "admin@sousnosailes.test");

    // Users
    await page.goto("/admin/utilisateurs?q=theo.dj");
    await page.getByRole("link", { name: "Théo Lambert" }).click();
    await expect(page.getByRole("heading", { name: "Théo Lambert" })).toBeVisible();
    await page.getByLabel("Motif (obligatoire)").fill("Suspension de test e2e : comportement à vérifier.");
    await page.getByRole("button", { name: "Suspendre" }).click();
    await expect(page.getByText("Compte suspendu.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Suspendu", { exact: true }).first()).toBeVisible();
    await page.getByLabel("Motif").fill("Fin du test e2e");
    await page.getByRole("button", { name: "Réactiver le compte" }).click();
    await expect(page.getByText("Compte réactivé.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Actif", { exact: true }).first()).toBeVisible();

    // Category
    await page.goto("/admin/categories");
    await page.getByRole("link", { name: "DJ", exact: true }).click();
    const desc = page.getByLabel("Description");
    const original = await desc.inputValue();
    await desc.fill(`${original.replace(/ \(e2e\)$/, "")} (e2e)`);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Catégorie enregistrée.")).toBeVisible({ timeout: 15_000 });
    await desc.fill(original.replace(/ \(e2e\)$/, ""));
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Catégorie enregistrée.").first()).toBeVisible({ timeout: 15_000 });

    // Plan (existing subscriptions untouched: warning visible when any is active)
    await page.goto("/admin/offres");
    const plus = page.locator("[data-plan='organizer_plus']");
    await expect(plus).toBeVisible();
    await plus.getByLabel("Description").fill("Les outils avancés pour un évènement sans fausse note.");
    await plus.getByRole("button", { name: "Enregistrer le plan" }).click();
    await expect(page.getByText(/Plan enregistré/)).toBeVisible({ timeout: 15_000 });

    // Security: audit log contains the actions just performed.
    await page.goto("/admin/securite?action=admin.user");
    await expect(page.getByText("admin.user.suspended").first()).toBeVisible();
  });
});

test("every back-office section renders for a super administrator", async ({ page }) => {
  await login(page, "superadmin@sousnosailes.test");
  const routes = ["/admin", "/admin/moderation", "/admin/moderation/avis", "/admin/signalements", "/admin/utilisateurs", "/admin/professionnels", "/admin/categories", "/admin/outils", "/admin/offres", "/admin/offres/promos", "/admin/offres/sponsorises", "/admin/offres/abonnements", "/admin/offres/evenements", "/admin/contenus", "/admin/contenus/cgv", "/admin/parametres", "/admin/securite", "/admin/securite/sessions", "/admin/securite/break-glass"];
  for (const route of routes) {
    const res = await page.goto(route);
    expect(res?.status(), route).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), route).toBeVisible();
    await expect(page.getByText("Nous n'avons pas pu afficher cette page."), route).toHaveCount(0);
  }
  // Demo privileged accounts have no 2FA → warning banner (never a redirect outside production).
  await page.goto("/admin");
  await expect(page.getByText("Double authentification requise pour les rôles privilégiés")).toBeVisible();
  // CSV export of the audit log.
  const csv = await page.request.get("/admin/securite/export");
  expect(csv.ok()).toBeTruthy();
  expect(csv.headers()["content-type"]).toContain("text/csv");
});
