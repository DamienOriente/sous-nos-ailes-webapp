import { expect, test } from "@playwright/test";

/**
 * Public site: home, navigation, legal pages, cookie banner (refuse = accept in
 * one click, no pre-ticked choice), report and contact forms. No account needed.
 */
test.describe("Accueil", () => {
  test("présente la promesse, la recherche et les deux parcours", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Les enfants sont pris en charge");
    const search = page.getByRole("search", { name: "Rechercher un professionnel" });
    await expect(search.getByLabel("Quel professionnel ?")).toHaveValue("garde-enfants-evenementielle");
    await expect(page.getByRole("link", { name: "Je prépare un évènement" })).toHaveAttribute("href", "/inscription?intent=organizer");
    await expect(page.getByRole("link", { name: "Je propose mes services" })).toHaveAttribute("href", "/inscription?intent=professional");
    // No invented social proof.
    await expect(page.locator("body")).not.toContainText(/2 ?000 pros/);
    // Structured data present.
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toContain('"WebSite"');
    expect(ld).toContain("SearchAction");
  });

  test("la recherche redirige vers l'annuaire du métier avec la ville", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("search", { name: "Rechercher un professionnel" });
    await search.getByLabel("Où ?").fill("Toulouse");
    await search.getByRole("button", { name: "Chercher" }).click();
    await expect(page).toHaveURL(/\/annuaire\/garde-enfants-evenementielle\?city=Toulouse$/);
  });

  test("la navigation principale et le pied de page mènent aux pages publiques", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Organiser un évènement" }).click();
    await expect(page).toHaveURL(/\/organiser$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Préparer un évènement");
    await page.getByRole("contentinfo").getByRole("link", { name: "À propos" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Des ailes");
  });
});

test.describe("Pages juridiques", () => {
  for (const [path, title] of [
    ["/mentions-legales", "Mentions légales"],
    ["/cgu", "Conditions générales d'utilisation"],
    ["/confidentialite", "Politique de confidentialité"],
    ["/droits-rgpd", "Vos droits"],
    ["/accessibilite", "Déclaration d'accessibilité"],
  ] as const) {
    test(`${path} s'affiche avec un titre et sans donnée inventée`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
      // Placeholders are visible, never a fake SIRET.
      await expect(page.locator("body")).not.toContainText(/\b\d{3} \d{3} \d{3} \d{5}\b/);
    });
  }

  test("une page juridique en brouillon affiche l'avertissement et un sommaire", async ({ page }) => {
    await page.goto("/cgu");
    await expect(page.locator("article").getByRole("note").first()).toContainText("Brouillon à valider par un professionnel du droit");
    await expect(page.getByRole("navigation", { name: "Sommaire" })).toBeVisible();
  });
});

test.describe("Bannière cookies", () => {
  test("refuser est aussi simple qu'accepter : un clic, puis la bannière disparaît et le choix est conservé", async ({ page, context }) => {
    await page.goto("/");
    const banner = page.getByTestId("cookie-banner");
    await expect(banner).toBeVisible();
    const refuse = banner.getByRole("button", { name: "Tout refuser" });
    const accept = banner.getByRole("button", { name: "Tout accepter" });
    await expect(refuse).toBeVisible();
    await expect(accept).toBeVisible();
    // Same visual weight: identical data-variant on both buttons.
    expect(await refuse.getAttribute("data-variant")).toBe(await accept.getAttribute("data-variant"));
    await refuse.click();
    await expect(banner).toBeHidden();
    const cookie = (await context.cookies()).find((c) => c.name === "sna_consent");
    expect(cookie).toBeTruthy();
    expect(decodeURIComponent(cookie!.value)).toContain('"a":0');
    await page.reload();
    await expect(page.getByTestId("cookie-banner")).toHaveCount(0);
  });

  test("les préférences détaillées sont modifiables sur /cookies", async ({ page }) => {
    await page.goto("/cookies#preferences");
    await expect(page.getByTestId("cookie-banner")).toHaveCount(0);
    const essential = page.getByLabel("Strictement nécessaires");
    await expect(essential).toBeDisabled();
    await expect(essential).toBeChecked();
    const analytics = page.getByLabel("Mesure d'audience");
    await expect(analytics).not.toBeChecked();
    await analytics.click();
    await page.getByRole("button", { name: "Enregistrer mes préférences" }).click();
    await expect(page.getByText("Préférences enregistrées")).toBeVisible();
    await expect(page.getByText(/Dernier choix enregistré le/)).toBeVisible();
  });
});

test.describe("Formulaires publics", () => {
  test("le formulaire de signalement valide puis enregistre sans compte", async ({ page }) => {
    await page.goto("/signalement");
    await page.getByRole("button", { name: "Envoyer le signalement" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("Vérifiez les champs");
    await page.getByLabel("Que signalez-vous ?").selectOption("review");
    await page.getByLabel("Motif").selectOption("fake_review");
    await page.getByLabel("Lien ou nom du contenu").fill("https://localhost/pro/e2e-fiche");
    await page.getByLabel("Que s'est-il passé ?").fill("Avis manifestement rédigé par le professionnel lui-même (test e2e).");
    await page.getByRole("button", { name: "Envoyer le signalement" }).click();
    await expect(page.getByTestId("report-success")).toContainText("Signalement enregistré");
  });

  test("le formulaire de contact signale les erreurs puis confirme l'envoi", async ({ page }) => {
    await page.goto("/contact");
    const form = page.locator("form");
    if ((await form.count()) === 0) test.skip(true, "contact address not configured (legal.contact_email)");
    await page.getByLabel("Votre nom").fill("E2E");
    await page.getByLabel("Votre e-mail").fill("pas-un-email");
    await page.getByLabel("Sujet").fill("Test");
    await page.getByLabel("Message").fill("court");
    await page.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(page.getByText("Adresse e-mail invalide.")).toBeVisible();
    await page.getByLabel("Votre e-mail").fill("e2e-contact@sousnosailes.test");
    await page.getByLabel("Message").fill("Bonjour, ceci est un message de test envoyé par la suite end-to-end.");
    await page.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Message envoyé" })).toBeVisible();
  });
});
