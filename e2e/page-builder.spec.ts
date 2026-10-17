import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { login } from "./_auth";

/**
 * Page builder journey for the demo childcare professional (Marie): edit a
 * text, reorder a section, switch template, preview, submit for review, and
 * check that the public page keeps showing the previously approved version.
 * Requires the demo seed (professionals + pages).
 */
const EMAIL = "marie.garde@sousnosailes.test";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://sna:sna@localhost:5450/sna";

type Listing = { id: string; slug: string; displayName: string; publishedTitle: string | null };

async function loadListing(): Promise<Listing> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query<{ id: string; slug: string; display_name: string; content: Array<{ type: string; props: { title?: string } }> | null }>(
      `select p.id, p.slug, p.display_name, pv.content
         from professionals p
         join users u on u.id = p.owner_user_id
         left join public_profiles pp on pp.professional_id = p.id
         left join profile_versions pv on pv.id = pp.published_version_id
        where u.email = $1 limit 1`,
      [EMAIL],
    );
    const row = res.rows[0];
    if (!row) throw new Error("demo listing for Marie not found: run pnpm db:seed");
    const hero = row.content?.find((b) => b.type === "hero");
    return { id: row.id, slug: row.slug, displayName: row.display_name, publishedTitle: hero?.props.title ?? null };
  } finally {
    await client.end();
  }
}

async function waitSaved(page: Page) {
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 15_000 });
}

test.describe("constructeur de page publique", () => {
  test("édition, réordonnancement, template, aperçu, soumission, page publiée intacte", async ({ page }) => {
    const listing = await loadListing();
    test.skip(!listing.publishedTitle, "Marie has no published version (pages seed not run)");
    await login(page, EMAIL);
    await page.goto(`/app/pro/${listing.id}/page`);
    await expect(page.getByTestId("page-builder")).toBeVisible();
    await expect(page.getByText(/version \d+ en ligne/i)).toBeVisible();

    // 1. Edit the hero title: live preview and autosave.
    await page.getByTestId("section-hero").click();
    const newTitle = `${listing.displayName} — test ${Date.now().toString().slice(-5)}`;
    const titleInput = page.getByTestId("hero-title-input");
    await titleInput.fill(newTitle);
    await expect(page.getByTestId("live-preview").getByRole("heading", { level: 1 })).toHaveText(newTitle);
    await waitSaved(page);

    // 2. Reorder: move the second body section down, the list order must change.
    const list = page.getByRole("list", { name: "Sections de la page" });
    const before = await list.locator("li").allInnerTexts();
    const second = list.locator("li").nth(1);
    const secondLabel = (await second.locator("button").nth(1).innerText()).split("\n")[0];
    await second.getByRole("button", { name: /^Descendre/ }).click();
    const after = await list.locator("li").allInnerTexts();
    expect(after).not.toEqual(before);
    expect(after[2]).toContain(secondLabel ?? "");
    await waitSaved(page);

    // 3. Switch to another free template: the preview re-renders with it.
    await page.getByRole("tab", { name: "Template" }).click();
    await page.getByTestId("template-sauge-elegante").click();
    await expect(page.getByTestId("live-preview").locator("[data-template='sauge-elegante']")).toBeVisible();
    await waitSaved(page);

    // 4. Full-screen preview of the draft.
    await page.getByTestId("preview-link").click();
    await expect(page.getByTestId("draft-preview")).toBeVisible();
    await expect(page.getByTestId("draft-preview").getByRole("heading", { level: 1 })).toHaveText(newTitle);
    await page.goBack();
    await expect(page.getByTestId("page-builder")).toBeVisible();

    // 5. Submit for review (confirmation dialog explains the process).
    const submit = page.getByTestId("submit-review");
    if (await submit.isEnabled()) {
      await submit.click();
      await expect(page.getByRole("alertdialog")).toContainText("relit chaque page");
      await page.getByTestId("confirm-submit").click();
      await expect(page.getByText(/en attente de modération/i)).toBeVisible({ timeout: 15_000 });
    }

    // 6. The public page still serves the approved version, not the draft.
    const res = await page.goto(`/pro/${listing.slug}`);
    expect(res?.status()).toBe(200);
    const publicHeading = page.locator("[data-template]").getByRole("heading", { level: 1 });
    await expect(publicHeading).toHaveText(listing.publishedTitle!);
    await expect(publicHeading).not.toHaveText(newTitle);
    await expect(page.locator("script[type='application/ld+json']").first()).toHaveCount(1);
    await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);

    // Restore the title in the draft so re-runs stay readable.
    await page.goto(`/app/pro/${listing.id}/page`);
    await page.getByTestId("section-hero").click();
    await page.getByTestId("hero-title-input").fill(listing.displayName);
    await waitSaved(page);
  });

  test("galerie publique des templates", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("24 mises en page");
    await expect(page.getByRole("link", { name: /Nid douillet/ })).toBeVisible();
    await page.getByRole("link", { name: /Galerie noire/ }).click();
    await expect(page).toHaveURL(/\/templates\/galerie-noire/);
    await expect(page.locator("[data-template='galerie-noire']")).toBeVisible();
    await page.getByRole("link", { name: /Anthracite/ }).click();
    await expect(page.locator("[data-palette='anthracite-cuivre']")).toBeVisible();
  });
});
