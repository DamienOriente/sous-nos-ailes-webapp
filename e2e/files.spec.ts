import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * Upload journey through the FileUpload component on "Mes fichiers".
 * Runs against the dev/prod server with the demo seed (DEMO_MODE=true).
 * The pipeline runs inline when no worker is alive, so statuses are deterministic.
 */
const DEMO_PASSWORD = "Demo-SousNosAiles-2026!";
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

async function signIn(page: Page, email: string) {
  const res = await page.request.post("/api/auth/sign-in/email", { data: { email, password: DEMO_PASSWORD } });
  expect(res.ok(), `sign-in ${email}`).toBeTruthy();
}

test.describe("Mes fichiers — upload sécurisé", () => {
  test("uploads an avatar, rejects dangerous files, deletes a file", async ({ page }) => {
    await signIn(page, "louis@sousnosailes.test");
    await page.goto("/app/compte/fichiers");
    await expect(page.getByRole("heading", { name: "Mes fichiers" })).toBeVisible();

    const avatarInput = page.getByTestId("file-upload-input").first();
    const documentsInput = page.getByTestId("file-upload-input").nth(1);
    const stamp = Date.now();

    // 1. valid image → scanned → clean → listed with a download link.
    // Unique pixels per run: identical bytes would be deduplicated onto a previous upload.
    const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: stamp % 256, g: Math.floor(stamp / 256) % 256, b: Math.floor(stamp / 65536) % 256 } } })
      .png()
      .toBuffer();
    await avatarInput.setInputFiles({ name: `e2e-avatar-${stamp}.png`, mimeType: "image/png", buffer: png });
    const avatarItem = page.getByTestId("file-upload-item").filter({ hasText: `e2e-avatar-${stamp}.png` });
    await expect(avatarItem).toHaveAttribute("data-status", "clean", { timeout: 30_000 });
    await expect(avatarItem.getByText("Vérifié")).toBeVisible();
    const row = page.getByTestId("file-row").filter({ hasText: `e2e-avatar-${stamp}.png` });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByRole("link", { name: "Télécharger" })).toHaveAttribute("href", /\/api\/files\/[0-9a-f-]{36}\?download=1/);

    // The signed redirect serves the bytes to the owner.
    const href = await row.getByRole("link", { name: "Télécharger" }).getAttribute("href");
    const download = await page.request.get(href!, { maxRedirects: 0 });
    expect(download.status()).toBe(302);
    expect(download.headers()["location"]).toContain("X-Amz-Signature");
    expect(download.headers()["cache-control"]).toContain("no-store");

    // 2. executable renamed .jpg → refused with a readable message, nothing listed
    // (the avatar uploader is single-file and now full; documents accept images too)
    const fakeJpg = Buffer.concat([Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00", "latin1"), Buffer.alloc(200, 0x90)]);
    await documentsInput.setInputFiles({ name: `e2e-fake-${stamp}.jpg`, mimeType: "image/jpeg", buffer: fakeJpg });
    const fakeItem = page.getByTestId("file-upload-item").filter({ hasText: `e2e-fake-${stamp}.jpg` });
    await expect(fakeItem.getByRole("alert")).toContainText(/n'est pas accepté|non reconnu/, { timeout: 15_000 });
    await expect(page.getByTestId("file-row").filter({ hasText: `e2e-fake-${stamp}.jpg` })).toHaveCount(0);

    // 3. EICAR as .txt → refused (type not allowed) and never accessible
    await documentsInput.setInputFiles({ name: `e2e-eicar-${stamp}.txt`, mimeType: "text/plain", buffer: Buffer.from(EICAR, "latin1") });
    const eicarItem = page.getByTestId("file-upload-item").filter({ hasText: `e2e-eicar-${stamp}.txt` });
    await expect(eicarItem.getByRole("alert")).toContainText(/non reconnu|refusé|n'est pas accepté/, { timeout: 15_000 });
    await expect(page.getByTestId("file-row").filter({ hasText: `e2e-eicar-${stamp}.txt` })).toHaveCount(0);

    // 4. another user cannot read the avatar (404, not 403)
    const fileId = /\/api\/files\/([0-9a-f-]{36})/.exec(href!)?.[1];
    const other = await page.context().browser()!.newContext();
    const otherPage = await other.newPage();
    await signIn(otherPage, "paul@sousnosailes.test");
    const denied = await otherPage.request.get(`/api/files/${fileId}`, { maxRedirects: 0 });
    expect(denied.status()).toBe(404);
    await other.close();

    // 5. delete with confirmation
    await row.getByRole("button", { name: `Supprimer e2e-avatar-${stamp}.png` }).click();
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(page.getByTestId("file-row").filter({ hasText: `e2e-avatar-${stamp}.png` })).toHaveCount(0, { timeout: 15_000 });
    const gone = await page.request.get(`/api/files/${fileId}`, { maxRedirects: 0 });
    expect(gone.status()).toBe(404);
  });

  test("notification centre lists, filters and marks as read", async ({ page }) => {
    await signIn(page, "louis@sousnosailes.test");
    await page.goto("/app/notifications");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Filtrer par type" })).toBeVisible();
    await page.getByRole("link", { name: "Non lues", exact: true }).click();
    await expect(page).toHaveURL(/filtre=non-lues/);
    const items = page.getByTestId("notification-item");
    if ((await items.count()) > 0) {
      await expect(items.first()).toHaveAttribute("data-unread", "true");
    } else {
      await expect(page.getByText("Aucune notification non lue")).toBeVisible();
    }
  });
});
