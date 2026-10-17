import { expect, test } from "@playwright/test";
import { closeFixtures, ensureFixtureEvent, login } from "./support/guests-fixtures";
import { Pool } from "pg";

/**
 * Vitality pass: the demo wedding is rich (cover photo, moments, progress,
 * providers with pictures, kids team, messages) and a bare event shows the
 * illustrated empty states whose chips create real rows (classic moments,
 * budget template, suggested tasks).
 */
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://sna:sna@localhost:5450/sna";
const SHOTS = process.env.VITALITY_SHOTS_DIR ?? "test-results/vitality";
let pool: Pool;
let bareEventId: string;
let richEventId: string;

test.beforeAll(async () => {
  pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
  ({ eventId: bareEventId } = await ensureFixtureEvent());
  const r = await pool.query<{ id: string }>(`select id from events where name = 'Mariage de Louis et Lisa' and is_demo and deleted_at is null limit 1`);
  if (!r.rows[0]) throw new Error("demo wedding missing — run pnpm db:seed");
  richEventId = r.rows[0].id;
  // The bare event starts empty every run.
  await pool.query(`delete from event_milestones where event_id = $1`, [bareEventId]);
  await pool.query(`delete from event_budget_lines where event_id = $1`, [bareEventId]);
  await pool.query(`delete from event_tasks where event_id = $1`, [bareEventId]);
});

test.afterAll(async () => {
  await pool.query(`delete from event_milestones where event_id = $1`, [bareEventId]);
  await pool.query(`delete from event_budget_lines where event_id = $1`, [bareEventId]);
  await pool.query(`delete from event_tasks where event_id = $1`, [bareEventId]);
  await pool.end();
  await closeFixtures();
});

test("liste des évènements et tableau de bord vivants (photos, moments, progression, équipe enfants)", async ({ page }) => {
  await login(page, "louis@sousnosailes.test");
  await page.goto("/app/evenements");
  await expect(page.getByRole("heading", { name: "Mes évènements" })).toBeVisible();
  const cards = page.getByTestId("event-card");
  await expect(cards.first()).toBeVisible();
  const rich = cards.filter({ hasText: "Mariage de Louis et Lisa" }).first();
  await expect(rich.locator("img").first()).toBeVisible();
  await expect(rich.getByRole("progressbar")).toBeVisible();
  await expect(rich.getByText(/tâches/)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SHOTS}/events-list.png`, fullPage: true });

  await page.goto(`/app/evenements/${richEventId}`);
  await expect(page.getByRole("heading", { name: "Mariage de Louis et Lisa" })).toBeVisible();
  await expect(page.getByLabel(/Compte à rebours/).first()).toBeVisible();
  await expect(page.getByTestId("dashboard-moments").locator("li")).toHaveCount(6);
  await expect(page.getByTestId("dashboard-sections").locator("li").first()).toBeVisible();
  await expect(page.getByTestId("dashboard-providers").locator("li").first()).toBeVisible();
  await expect(page.getByTestId("dashboard-kids")).toContainText("Marie Delcourt");
  await expect(page.getByTestId("dashboard-messages").locator("li")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Météo de l'organisation" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SHOTS}/dashboard.png`, fullPage: true });

  // Settings: the cover picker lists the catalogue and marks the current photo.
  await page.goto(`/app/evenements/${richEventId}/parametres`);
  // CardTitle renders a div; the first compile of the page can be slow on the dev server.
  await expect(page.getByText("Photo de couverture", { exact: true })).toBeVisible({ timeout: 60_000 });
  const catalog = page.getByRole("list", { name: "Photos du catalogue" });
  await expect(catalog.getByRole("button", { pressed: true })).toHaveCount(1);
  const alt = catalog.getByRole("button", { pressed: false }).first();
  await alt.click();
  await expect(page.getByText("Photo de couverture mise à jour.")).toBeVisible();
});

test("états vides illustrés et exemples réels (moments classiques, budget type, tâches suggérées)", async ({ page }) => {
  await login(page, "louis@sousnosailes.test");
  const base = `/app/evenements/${bareEventId}`;

  await page.goto(`${base}/planning`);
  await expect(page.getByTestId("planning-empty")).toContainText("Par exemple", { timeout: 60_000 });
  await page.getByTestId("add-suggested-milestones").click();
  await expect(page.getByText(/8 étapes ajoutées au planning/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ouverture de bal" })).toBeVisible();
  await expect(page.getByTestId("planning-empty")).toHaveCount(0);

  await page.goto(`${base}/budget`);
  await expect(page.getByTestId("budget-empty")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("apply-budget-template").click();
  await expect(page.getByText(/postes? de budget ajouté/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Postes de budget" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Imprévus (5 %)", exact: true })).toBeVisible();

  await page.goto(`${base}/taches`);
  await expect(page.getByTestId("tasks-empty")).toContainText("Réserver le traiteur — avant le 12 mars", { timeout: 60_000 });
  await page.getByTestId("add-suggested-tasks").click();
  await expect(page.getByText(/tâches ajoutées/)).toBeVisible();
  await expect(page.getByText("Prévoir le plan B en cas de pluie")).toBeVisible();

  await page.goto(`${base}/prestataires`);
  await expect(page.getByTestId("providers-empty")).toBeVisible({ timeout: 60_000 });
  await page.goto(`${base}/documents`);
  await expect(page.getByTestId("documents-empty")).toBeVisible({ timeout: 60_000 });
  await page.goto(`${base}/invitations`);
  await expect(page.getByTestId("invitations-empty")).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SHOTS}/empty-invitations.png`, fullPage: true });
});
