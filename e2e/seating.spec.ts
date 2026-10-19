import { expect, test } from "@playwright/test";
import { closeFixtures, createGuest, deleteGuestsByLastName, deleteTablesByName, ensureFixtureEvent, login } from "./support/guests-fixtures";

let eventId: string;
let guestId: string;

test.beforeAll(async () => {
  ({ eventId } = await ensureFixtureEvent());
  await deleteTablesByName(eventId, "E2E Table");
  await deleteGuestsByLastName(eventId, "E2E-Table");
  guestId = await createGuest(eventId, "Victor", "E2E-Table");
});

test.afterAll(async () => {
  await deleteTablesByName(eventId, "E2E Table");
  await deleteGuestsByLastName(eventId, "E2E-Table");
  await closeFixtures();
});

test("ajouter une table, placer un invité via le sélecteur, compteur de places, export PDF", async ({ page }) => {
  await login(page, "louis@sousnosailes.test");
  await page.goto(`/app/evenements/${eventId}/plan-de-table`);
  await expect(page.getByRole("heading", { name: "Plan de table" })).toBeVisible();

  // Add a table through the dialog
  await page.getByTestId("add-table").click();
  await page.getByLabel("Nom").fill("E2E Table");
  await page.getByLabel("Capacité").fill("4");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // Every row embeds a "move to table…" select listing all table names: match the row by its name button only.
  const row = page.locator('[data-testid^="table-row-"]').filter({ has: page.getByRole("button", { name: "E2E Table", exact: true }) });
  await expect(row).toBeVisible();
  await expect(row.locator('[data-testid^="occupancy-"]')).toHaveText(/0\/4/);
  await expect(page.getByRole("button", { name: /E2E Table, 0 sur 4 places/ })).toBeVisible();

  // Accessible assignment: select "Placer à…" on the unplaced guest
  const select = page.getByTestId(`assign-${guestId}`);
  await expect(select).toBeVisible();
  const option = select.locator("option", { hasText: "E2E Table" });
  await select.selectOption({ value: (await option.getAttribute("value")) ?? "" });
  await expect(row.locator('[data-testid^="occupancy-"]')).toHaveText(/1\/4 · 3 libre/);
  await expect(row).toContainText("Victor E2E-Table");
  await expect(page.getByTestId(`unplaced-${guestId}`)).toHaveCount(0);
  await expect(page.getByTestId("seat-counter")).toContainText("invités placés");

  // Keyboard move (accessible method): arrow key nudges the selected table
  const tableNode = page.getByRole("button", { name: /E2E Table, 1 sur 4 places/ });
  const xInput = row.getByLabel("Position X de E2E Table");
  const before = Number(await xInput.inputValue());
  await tableNode.focus();
  await page.keyboard.press("ArrowRight");
  await expect(xInput).toHaveValue(String(before + 10));

  // Print view and PDF export
  const pdf = await page.request.get(`/api/events/${eventId}/seating/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  await page.goto(`/app/evenements/${eventId}/plan-de-table/impression`);
  await expect(page.getByRole("heading", { name: "Liste par table" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /E2E Table/ })).toBeVisible();
});
