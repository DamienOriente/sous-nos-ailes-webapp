import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function signInAs(page: Page, name: RegExp) {
  await page.goto("/connexion?changer=1");
  await page.getByRole("button", { name }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
}

async function weddingBase(page: Page): Promise<string> {
  await page.goto("/app/evenements");
  await page.getByRole("link", { name: /Mariage de Louis et Lisa/ }).first().click();
  await page.waitForURL(/\/app\/evenements\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname;
}

test("avis vérifiés : l'organisateur note un pro de son évènement passé ; la page publique dit ce qui le prouve", async ({ page }) => {
  await signInAs(page, /Louis Marchand/);
  await page.goto("/app/avis");
  const opportunities = page.getByTestId("review-opportunities");
  await expect(opportunities.getByText("Les 40 ans de Louis").first()).toBeVisible();
  await page.goto("/pro/theo-lambert-dj");
  await expect(page.getByText(/avis vérifié \(Mariage, juin 2026\)/).first()).toBeVisible();
});

test("jour J : un retard décale ce qui en dépend", async ({ page }) => {
  await signInAs(page, /Louis Marchand/);
  const base = await weddingBase(page);
  await page.goto(`${base}/jour-j`);
  await expect(page.getByRole("heading", { level: 1, name: "Jour J en direct" })).toBeVisible();
  await page.getByRole("button", { name: "Signaler 10 minutes de retard sur Cérémonie laïque" }).click();
  const next = page.locator("[data-testid=live-step]:visible").filter({ has: page.getByRole("heading", { name: /^Sortie de cérémonie/ }) });
  await expect(next.getByTestId("live-shift")).toContainText("à cause de « Cérémonie laïque »");
});

test("budget : le devis accepté a créé l'acompte et le solde datés", async ({ page }) => {
  await signInAs(page, /Louis Marchand/);
  const base = await weddingBase(page);
  await page.goto(`${base}/budget`);
  const schedule = page.getByTestId("payment-schedule");
  await expect(schedule.getByText("Julien Rossi Traiteur").first()).toBeVisible();
  await expect(schedule).toContainText("acompte à la signature");
  await expect(schedule).toContainText("solde, 15 jours avant");
});

test("réseau : partenaires recommandés et souvent réservé avec sur la page publique", async ({ page }) => {
  await page.goto("/pro/marie-delcourt-garde-enfants");
  const panel = page.getByTestId("partners-panel");
  await expect(panel.getByRole("link", { name: "Sofia Martins" }).first()).toBeVisible();
  await expect(panel.getByText("Souvent réservé avec")).toBeVisible();
  await expect(panel).toContainText("Julien Rossi Traiteur");
});

test("rétroplanning : les réservations datées depuis le jour J", async ({ page }) => {
  await signInAs(page, /Louis Marchand/);
  const base = await weddingBase(page);
  await page.goto(`${base}/retroplanning`);
  const lieu = page.getByTestId("retro-item").filter({ hasText: "Réserver le lieu de réception" });
  await expect(lieu).toContainText("Réservé");
  await expect(page.getByTestId("retro-item").filter({ hasText: "Réserver la garde d'enfants" })).toContainText("Réservé");
});

test("nouvelles pages : aucune violation d'accessibilité grave", async ({ page }) => {
  await signInAs(page, /Louis Marchand/);
  const base = await weddingBase(page);
  for (const path of [`${base}/jour-j`, `${base}/retroplanning`, `${base}/budget`, "/app/avis", "/pro/marie-delcourt-garde-enfants"]) {
    await page.goto(path);
    await page.waitForLoadState("load");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${path} ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  }
});
