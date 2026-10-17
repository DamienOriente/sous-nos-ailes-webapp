import { expect, test } from "@playwright/test";
import { DEMO, login, searchMail } from "./helpers";

test.describe("client space", () => {
  test("the client sees only their own files with the stage of each one", async ({ page }) => {
    await login(page, DEMO.client1, "/espace-client");
    await expect(page.getByRole("link", { name: /LPI-DEMO-0001/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /LPI-DEMO-0003/ })).toBeVisible();
    await expect(page.getByText("LPI-DEMO-0002")).toHaveCount(0);
  });

  test("the client gives an agreement in principle on the current proposal (idempotent)", async ({ page }) => {
    await login(page, DEMO.client2, "/espace-client");
    await page.getByRole("link", { name: /LPI-DEMO-0002/ }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/LPI-DEMO-0002|Mariage/);
    const accept = page.getByRole("button", { name: "Cette proposition me convient" });
    if (await accept.count()) {
      await accept.click();
      await expect(page.getByText(/Accord de principe/).first()).toBeVisible();
      await expect.poll(async () => (await searchMail("subject:\"Accord de principe — LPI-DEMO-0002\"")).length, { timeout: 15_000 }).toBeGreaterThan(0);
    } else {
      await expect(page.getByText(/Accord de principe donné|Équipe en cours de constitution/).first()).toBeVisible();
    }
    // Costs and internal notes never reach the client
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/Coût|coût convenu|Notes internes|relancer Chloé/i);
    // The superseded version stays readable in the history
    await expect(page.getByText(/Remplacée|version 1/i).first()).toBeVisible();
  });

  test("the client can answer preparation questions without medical data prompts", async ({ page }) => {
    await login(page, DEMO.client1, "/espace-client");
    await page.getByRole("link", { name: /LPI-DEMO-0001/ }).first().click();
    await expect(page.getByText("N’indiquez aucune information médicale ou sensible").first()).toBeVisible();
    await page.getByLabel(/Point de rendez-vous/).fill("Portail nord, 16 h 30 (test)");
    await page.getByRole("button", { name: "Enregistrer mes réponses" }).click();
    await expect(page.getByText(/enregistr/i).first()).toBeVisible();
  });
});

test.describe("provider space", () => {
  test("a provider sees pending proposals without client identity and can answer (idempotent)", async ({ page }) => {
    await login(page, DEMO.providerChloe, "/espace-intervenant");
    const main = page.locator("main");
    const text = await main.innerText();
    expect(text).not.toMatch(/Camille|Durand|camille\.durand/);
    const accept = main.getByRole("button", { name: "Accepter" }).first();
    if (await accept.count()) {
      await accept.click();
      await expect(page.getByText(/Disponibilités transmises|acceptée/i).first()).toBeVisible();
      await expect.poll(async () => (await searchMail("subject:\"a accepté\"")).length, { timeout: 15_000 }).toBeGreaterThan(0);
    } else {
      await expect(page.getByText(/Disponibilités transmises|Propositions en attente/).first()).toBeVisible();
    }
  });

  test("an assigned provider reads the operational brief", async ({ page }) => {
    await login(page, DEMO.providerDorian, "/espace-intervenant");
    await expect(page.getByText("LPI-DEMO-0004")).toBeVisible();
    await expect(page.getByText(/Cour arrière/)).toBeVisible();
    const briefLink = page.getByRole("link", { name: /brief/i }).first();
    await briefLink.click();
    await expect(page.getByRole("heading", { name: /Brief de mission/ })).toBeVisible();
    await expect(page.getByText("Thomas Lefèvre")).toBeVisible(); // on-site operational contact only
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/thomas\.lefevre@|Coût/);
  });

  test("a provider manages availabilities", async ({ page }) => {
    await login(page, DEMO.providerAlix, "/espace-intervenant");
    await page.goto("/espace-intervenant/disponibilites");
    await page.getByLabel("Indisponible").check();
    await page.getByLabel("Début — date").fill("2027-12-24");
    await page.getByLabel("Début — heure").fill("08:00");
    await page.getByLabel("Fin — date").fill("2027-12-26");
    await page.getByLabel("Fin — heure").fill("23:00");
    await page.getByRole("button", { name: /Ajouter|Enregistrer/ }).click();
    await expect(page.getByText(/24 déc\. 2027|24\/12\/2027/).first()).toBeVisible();
  });
});

test.describe("partner space", () => {
  test("the partner gets their link, QR code and kit", async ({ page, request }) => {
    await login(page, DEMO.partner, "/espace-partenaire");
    await expect(page.getByText(/\/p\/tilleuls/)).toBeVisible();
    const qr = await page.request.get("/espace-partenaire/qr");
    expect(qr.status()).toBe(200);
    expect(qr.headers()["content-type"]).toContain("image/png");
    await page.goto("/espace-partenaire/kit");
    await expect(page.getByText("Organiser la garde des enfants dans ce lieu")).toBeVisible();
    // Anonymous access to the QR is refused
    const anonymous = await request.get("/espace-partenaire/qr", { maxRedirects: 0 });
    expect([302, 307, 404]).toContain(anonymous.status());
  });
});
