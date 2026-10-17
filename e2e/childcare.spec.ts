import { expect, test } from "@playwright/test";
import { closeDb, EMAILS, ensureDemoEvent, signIn } from "./_childcare-fixture";

let eventId: string;

test.beforeAll(async () => {
  ({ eventId } = await ensureDemoEvent());
});
test.afterAll(async () => {
  await closeDb();
});

test.describe("Garde d'enfants", () => {
  test("Marie (nounou affectée) voit ses 5 enfants, enregistre une arrivée et consulte une info sensible avec motif", async ({ page }) => {
    await signIn(page, EMAILS.marie);
    await page.goto(`/app/evenements/${eventId}/enfants`);
    await expect(page.getByRole("heading", { name: "Mes enfants" })).toBeVisible();
    await expect(page.getByTestId("roster-row")).toHaveCount(5);
    await expect(page.getByTestId("presence-dashboard")).toContainText("5");
    // Nora's children are not listed.
    await expect(page.getByText("Gabriel")).toHaveCount(0);

    // Check-in from the roster (Inaya is still expected in the seed).
    const inayaRow = page.getByTestId("roster-row").filter({ hasText: "Inaya" });
    const arrival = inayaRow.getByRole("button", { name: /Arrivée/ });
    if (await arrival.isVisible()) {
      await arrival.click();
      await expect(inayaRow.getByText("Présent")).toBeVisible();
    }

    // Sensitive read with a purpose on Léa (allergies + consent in the seed).
    await page.getByRole("link", { name: /Léa Marchand/ }).click();
    await expect(page.getByRole("heading", { name: /Léa Marchand/ })).toBeVisible();
    await expect(page.getByText("Allergies renseignées")).toBeVisible();
    await expect(page.getByText("Arachide")).toHaveCount(0); // never shown before the purpose is given
    await page.getByLabel("Motif de la consultation *").fill("Préparation du goûter");
    await page.getByRole("button", { name: "Consulter" }).click();
    await expect(page.getByRole("region", { name: "Informations de santé déchiffrées" })).toContainText("Arachide");
  });

  test("Louis (propriétaire) voit tous les enfants et le journal d'accès avec la lecture de Marie", async ({ page }) => {
    await signIn(page, EMAILS.louis);
    await page.goto(`/app/evenements/${eventId}/enfants`);
    await expect(page.getByRole("heading", { name: "Enfants accueillis" })).toBeVisible();
    await expect(page.getByTestId("roster-row")).toHaveCount(9);
    await page.getByRole("link", { name: "Journal d'accès" }).click();
    await expect(page.getByRole("heading", { name: /Journal d'accès/ })).toBeVisible();
    const rows = page.getByTestId("access-log-row");
    await expect(rows.first()).toBeVisible();
    await expect(rows.filter({ hasText: "Marie Delcourt" }).filter({ hasText: "Préparation du goûter" }).first()).toBeVisible();
  });

  test("Julien (traiteur) n'accède pas aux enfants mais voit le décompte alimentaire anonyme", async ({ page }) => {
    await signIn(page, EMAILS.julien);
    // The event layout streams first (loading boundary), so the status is not reliable: assert the not-found content.
    await page.goto(`/app/evenements/${eventId}/enfants`);
    await expect(page.getByText("Cette page n'existe pas ou n'est plus disponible.")).toBeVisible();
    await expect(page.getByTestId("roster-row")).toHaveCount(0);
    await page.goto(`/app/evenements/${eventId}/traiteur`);
    await expect(page.getByRole("heading", { name: "Traiteur" })).toBeVisible();
    await expect(page.getByTestId("dietary-row").first()).toBeVisible();
    await expect(page.getByText("Léa")).toHaveCount(0);
  });
});
