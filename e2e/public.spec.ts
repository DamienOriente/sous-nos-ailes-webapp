import { expect, test } from "@playwright/test";
import { readMail, searchMail, uniqueEmail } from "./helpers";

test.describe("public site", () => {
  test("home page renders the editorial composition and the main CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Une attention pour les enfants");
    await expect(page.getByRole("link", { name: "Parler de mon événement" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Le déroulement" })).toBeVisible();
    // No fake social proof
    await expect(page.getByText("Ils nous ont fait confiance")).toHaveCount(0);
  });

  test("demo mode stays non-indexable (meta robots + robots.txt + empty sitemap)", async ({ page, request }) => {
    await page.goto("/");
    const robotsMeta = page.locator('meta[name="robots"]');
    await expect(robotsMeta).toHaveAttribute("content", /noindex/);
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toMatch(/Disallow: \//);
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).not.toMatch(/<loc>/);
  });

  test("security headers and CSP nonce are present", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["content-security-policy"]).toMatch(/nonce-/);
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("an invalid request creates nothing and shows understandable errors", async ({ page }) => {
    await page.goto("/demander-un-devis");
    // Try to continue without a date
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Indiquez la date, ou choisissez « date encore incertaine ».")).toBeVisible();
    await expect(page).toHaveURL(/demander-un-devis$/);
  });

  test("a visitor submits a complete request and receives an acknowledgement in the local inbox", async ({ page }) => {
    const email = uniqueEmail("organisateur");
    await page.goto("/demander-un-devis");
    await page.getByLabel("Mariage", { exact: true }).check();
    await page.getByLabel("Date de l’événement").fill("2027-06-12");
    await page.getByLabel("Début de la garde").fill("18:00");
    await page.getByLabel("Fin de la garde").fill("01:30");
    await page.getByRole("button", { name: "Continuer" }).click();

    await page.getByLabel("Un autre lieu").check();
    await page.getByLabel("Nom ou type de lieu").fill("Salle des fêtes (test)");
    await page.getByLabel("Commune").fill("Lyon");
    await page.getByLabel("Code postal").fill("69003");
    await page.getByRole("button", { name: "Continuer" }).click();

    await page.getByLabel("3 à 5 ans").fill("4");
    await page.getByLabel("6 à 10 ans").fill("3");
    await page.getByRole("button", { name: "Continuer" }).click();

    await page.getByLabel("Votre nom").fill("Test Organisateur");
    await page.getByLabel("Votre email").fill(email);
    await page.getByLabel("Un mot sur votre événement").fill("Parcours de test automatisé.");
    await page.getByLabel(/J’ai pris connaissance de la/).check();
    await page.getByRole("button", { name: "Continuer" }).click();

    await expect(page.getByRole("heading", { name: "Récapitulatif" })).toBeVisible();
    await expect(page.getByText("Salle des fêtes (test)")).toBeVisible();
    // Anti double-submit: the form was opened a few seconds ago; wait so the min fill time passes.
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page).toHaveURL(/demander-un-devis\/merci\?ref=LPI-/);
    const reference = new URL(page.url()).searchParams.get("ref")!;
    expect(reference).toMatch(/^LPI-\d{4}-\d{4}$/);
    await expect(page.getByText(reference)).toBeVisible();

    await expect.poll(async () => (await searchMail(`to:${email}`)).length, { timeout: 15_000 }).toBeGreaterThan(0);
    const messages = await searchMail(`to:${email}`);
    expect(messages[0].Subject).toContain(reference);
    const mail = await readMail(messages[0].ID);
    expect(mail.Text).toContain("ne constitue pas une réservation");
    expect(mail.Text).toMatch(/\/connexion\/lien\//);
  });

  test("a partner referral link keeps its source on the request", async ({ page, context }) => {
    const email = uniqueEmail("apport");
    await page.goto("/p/tilleuls");
    await expect(page).toHaveURL(/\/lieux\/domaine-des-tilleuls/);
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "lpi_ref")?.value).toMatch(/^tilleuls\.link$/);
    await page.getByRole("link", { name: "Organiser la garde des enfants dans ce lieu" }).first().click();
    await expect(page.getByText("Vous arrivez de la part de")).toBeVisible();
    await page.getByLabel("Fête privée", { exact: true }).check();
    await page.getByLabel("Date de l’événement").fill("2027-09-04");
    await page.getByLabel("Début de la garde").fill("15:00");
    await page.getByLabel("Fin de la garde").fill("20:00");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByRole("combobox", { name: /Lieu partenaire/ })).toHaveValue(/.+/);
    await page.getByLabel("Code postal").fill("69999");
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("3 à 5 ans").fill("5");
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Votre nom").fill("Test Apport");
    await page.getByLabel("Votre email").fill(email);
    await page.getByLabel(/J’ai pris connaissance de la/).check();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page).toHaveURL(/merci\?ref=LPI-/);
    const reference = new URL(page.url()).searchParams.get("ref")!;
    // Marie's notification names the partner origin
    await expect.poll(async () => (await searchMail(`subject:${reference}`)).length, { timeout: 15_000 }).toBeGreaterThan(0);
    const admin = (await searchMail(`subject:"Nouvelle demande ${reference}"`))[0];
    expect(admin).toBeTruthy();
    const mail = await readMail(admin.ID);
    expect(mail.Text).toContain("lien partenaire");
  });

  test("keyboard navigation reaches the main CTA with a visible focus", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
      if (focused === "Parler de mon événement") break;
    }
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      return { text: el.textContent?.trim(), outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle };
    });
    expect(outline.text).toBe("Parler de mon événement");
    expect(outline.outlineStyle).not.toBe("none");
  });

  test("404 page is clean", async ({ page }) => {
    const response = await page.goto("/page-qui-n-existe-pas");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Cette page n’existe pas" })).toBeVisible();
  });
});
