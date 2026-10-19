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

test("brief partagé : l'organisateur voit ce que reçoivent les pros et à qui l'envoyer", async ({ page }) => {
  await signInAs(page, /Louis Marchand/);
  const base = await weddingBase(page);
  await page.goto(`${base}/brief`);
  const card = page.getByRole("region", { name: "Ce que reçoivent les professionnels" });
  await expect(card).toContainText("Champêtre chic");
  await expect(card).toContainText("120, dont");
  await expect(page.getByRole("heading", { name: "Envoyer le brief" })).toBeVisible();
  await expect(page.getByText("Vous avez posé une option").first()).toBeVisible();
  await expect(page.getByText("Déjà contacté").first()).toBeVisible();
});

test("comparateur : les devis du même métier côte à côte, au même format", async ({ page }) => {
  await signInAs(page, /Louis Marchand/);
  const base = await weddingBase(page);
  await page.goto(`${base}/devis`);
  const table = page.getByTestId("quotes-traiteur");
  await expect(table).toBeVisible();
  await expect(table.getByRole("link", { name: "La Table de Garonne" })).toBeVisible();
  await expect(table.getByRole("link", { name: "Julien Rossi Traiteur" })).toBeVisible();
  await expect(table.getByText("Le moins cher")).toBeVisible();
  await expect(table.getByRole("rowheader", { name: "Par invité" })).toBeVisible();
  await expect(table.getByRole("row", { name: /Vin d'honneur/ })).toContainText("Non inclus");
  // The DJ group has an expired quote, flagged as such.
  await expect(page.getByTestId("quotes-dj").getByText("Expiré")).toBeVisible();
});

test("option de 48 h : posée depuis la page publique, visible puis libérée dans l'évènement", async ({ page }) => {
  await signInAs(page, /Louis Marchand/);
  await page.goto("/pro/fleurs-sauvages-atelier?date=2027-06-12");
  const form = page.getByTestId("hold-form");
  // Other test files create events on the same date: pick the demo wedding explicitly.
  const select = form.getByLabel("Pour l'évènement");
  const value = await select.locator("option", { hasText: "Mariage de Louis et Lisa" }).first().getAttribute("value");
  await select.selectOption(value!);
  await form.getByRole("button", { name: "Poser une option de 48 h" }).click();
  await expect(page.getByTestId("hold-placed")).toContainText("Option posée chez");

  const base = await weddingBase(page);
  await page.goto(`${base}/demandes`);
  const holds = page.getByTestId("event-holds");
  const row = holds.getByRole("listitem").filter({ hasText: "Fleurs Sauvages" });
  await expect(row).toContainText("En attente du professionnel");
  await row.getByRole("button", { name: "Libérer" }).click();
  await expect(holds.getByRole("listitem").filter({ hasText: "Fleurs Sauvages" })).toHaveCount(0);
});

test("côté pro : le brief reçu et le devis au format commun", async ({ page }) => {
  // Théo's quote still awaits an answer (Julien's was accepted in the demo).
  await signInAs(page, /Théo Lambert/);
  await page.goto("/app/pro");
  await page.waitForURL(/\/app\/pro\/[0-9a-f-]{36}/);
  const listing = new URL(page.url()).pathname.split("/").slice(0, 4).join("/");
  await page.goto(`${listing}/demandes`);
  await page.getByTestId("inquiries-list").getByRole("link").filter({ hasText: "voici le brief de notre mariage" }).first().click();
  await expect(page.getByRole("region", { name: "Brief envoyé par l'organisateur" })).toContainText("Champêtre chic");
  await expect(page.getByTestId("sent-quote")).toContainText("Inclus : Sonorisation");
  await page.getByRole("tab", { name: "Envoyer un devis" }).click();
  await page.getByRole("button", { name: "Détailler par lignes" }).click();
  await page.getByLabel("Ligne 1 : prestation").fill("Menu");
  await page.getByLabel("Ligne 1 : quantité").fill("120");
  await page.getByLabel("Ligne 1 : prix unitaire").fill("80");
  await expect(page.getByText("Total TTC : 9 600,00 €")).toBeVisible();
  await expect(page.getByLabel("Conditions d'annulation")).toBeVisible();
});

test("annuaire : la recherche par date ne montre que les pros libres", async ({ page }) => {
  await page.goto("/annuaire?date=2027-06-12");
  await expect(page.getByTestId("results-count")).toContainText("libres le 12 juin 2027");
  await expect(page.getByText(/Disponibilité vérifiée sur l'agenda/)).toBeVisible();
});

test("brief, comparateur et page publique avec option : aucune violation d'accessibilité grave", async ({ page }) => {
  await signInAs(page, /Louis Marchand/);
  const base = await weddingBase(page);
  for (const path of [`${base}/brief`, `${base}/devis`, `${base}/demandes`, "/pro/douceurs-albigeoises?date=2027-06-12"]) {
    await page.goto(path);
    await page.waitForLoadState("load");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${path} ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  }
});
