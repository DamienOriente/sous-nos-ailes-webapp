import { expect, test } from "@playwright/test";

/**
 * Public site: home, navigation, legal pages, cookie banner (refuse = accept in
 * one click, no pre-ticked choice), report and contact forms. No account needed.
 */
test.describe("Accueil", () => {
  test("présente la promesse, la recherche et les deux parcours", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Garde d'enfants et animation");
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

  test("montre des exemples réels de la base, étiquetés démonstration", async ({ page }) => {
    await page.goto("/");
    // Only the hero photograph is loaded eagerly (LCP, preloaded); every other photo is lazy.
    const eager = page.locator('main img:not([loading="lazy"])');
    expect(await eager.count()).toBe(1);
    await expect(page.locator('link[rel="preload"][as="image"]')).toHaveCount(1);
    expect(await page.locator("main img").count()).toBeGreaterThan(10);
    // Illustrated steps.
    await expect(page.getByRole("heading", { name: "Comment ça se passe" })).toBeVisible();
    // Featured listings come from the directory ranking; demo rows are labelled.
    const featured = page.getByTestId("featured-professionals");
    if ((await featured.count()) > 0) {
      const cards = featured.locator('[data-testid="professional-card"]');
      expect(await cards.count()).toBeGreaterThanOrEqual(1);
      expect(await cards.count()).toBeLessThanOrEqual(3);
      const demoBadges = await cards.getByText("Démo", { exact: true }).count();
      if (demoBadges > 0) await expect(page.getByText("Fiches de démonstration, professionnels fictifs")).toBeVisible();
    }
    // Demo event snapshot: real counters, explicit demo label, never a health detail.
    const showcase = page.locator("#exemple-evenement");
    if ((await showcase.count()) > 0) {
      await expect(showcase.getByText("Tour de contrôle")).toBeVisible();
      await expect(showcase.getByText("Évènement fictif, personnes fictives")).toBeVisible();
      // First name + age only: no medical detail ever reaches a public page.
      await expect(showcase).not.toContainText(/allergique|asthm|épilep|médicament|traitement :/i);
    }
    // Journeys and FAQ about demo data.
    await expect(page.getByRole("heading", { name: /Trois exemples tirés de la démonstration/ })).toBeVisible();
    await page.getByRole("button", { name: "Les photos et les fiches que je vois sont-elles réelles ?" }).click();
    await expect(page.getByText(/photographies sont des illustrations libres de droits/)).toBeVisible();
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

test.describe("Pages marketing", () => {
  test("/organiser montre les écrans de l'évènement de démonstration et un exemple de demande", async ({ page }) => {
    await page.goto("/organiser");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Préparer un évènement");
    await expect(page.getByRole("heading", { name: /Avant : trouver et comparer/ })).toBeVisible();
    const space = page.locator("#espace-organisateur");
    if ((await space.count()) > 0) {
      await expect(space.getByText("Tour de contrôle")).toBeVisible();
      await expect(space.getByText("Plan de table", { exact: true })).toBeVisible();
      await expect(space.getByText("Espace enfants")).toBeVisible();
      await expect(space.getByRole("img", { name: /Plan de table avec \d+ tables/ })).toBeVisible();
    }
    await expect(page.getByText("Demande de devis", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Exemple", { exact: true }).first()).toBeVisible();
  });

  test("/professionnels explique les cinq étapes et montre des fiches réelles", async ({ page }) => {
    await page.goto("/professionnels");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Publiez votre fiche");
    await expect(page.getByRole("heading", { name: "Votre fiche en cinq étapes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Les demandes que vous recevez" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/certifié/i);
  });

  test("/a-propos, /contact et /accessibilite ont une illustration ou une photo", async ({ page }) => {
    await page.goto("/a-propos");
    await expect(page.locator("main img").first()).toBeVisible();
    await page.goto("/contact");
    await expect(page.locator("main svg").first()).toBeAttached();
    await page.goto("/accessibilite");
    await expect(page.locator("main svg").first()).toBeAttached();
  });
});

test.describe("Annuaire", () => {
  test("cartes illustrées, filtres rapides et état vide illustré", async ({ page }) => {
    await page.goto("/annuaire");
    await expect(page.locator("main img").first()).toBeVisible();
    const chip = page.getByRole("search", { name: "Rechercher un professionnel" }).getByRole("link", { name: "Enfants bienvenus" });
    await expect(chip).toHaveAttribute("href", /children=1/);
    await chip.click();
    await expect(page).toHaveURL(/children=1/);
    await expect(page.getByRole("link", { name: "Enfants bienvenus" })).toHaveAttribute("aria-current", "true");
    await expect(page.getByText("À quoi ressemble une demande")).toBeVisible();

    await page.goto("/annuaire/dj?city=Paris&radius=10");
    await expect(page.getByText("Aucun professionnel ne correspond à cette recherche")).toBeVisible();
    await expect(page.getByRole("link", { name: "Réinitialiser les filtres" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Exemple de demande de devis" })).toBeVisible();
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

/**
 * "Un site qui ne fait pas généré" : the writing and drawing rules agreed with the owner, checked on the
 * public pages. Demo rows (listing cards, demo event, reviews) come from the seed and are excluded.
 */
test.describe("Charte rédactionnelle et graphique", () => {
  const PAGES = ["/", "/organiser", "/professionnels", "/a-propos", "/tarifs", "/contact", "/annuaire", "/annuaire/garde-enfants-evenementielle", "/connexion", "/inscription"];

  for (const path of PAGES) {
    test(`${path} : pas de tiret cadratin, de surtitre en capitales ni de dégradé`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.title(), "titre de page").not.toContain("—");
      const findings = await page.evaluate(() => {
        const skip = '[data-testid="professional-card"], [data-testid="inquiry-example"], #espace-organisateur, #exemple-evenement, #avis, [data-testid="cookie-banner"]';
        const out: string[] = [];
        const main = document.querySelector("main");
        if (!main) return ["no <main>"];
        for (const el of main.querySelectorAll("h1,h2,h3,h4,p,li,dt,dd,label,button,a,summary,span")) {
          if (el.closest(skip)) continue;
          const own = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent ?? "")
            .join("");
          if (own.includes("—")) out.push(`dash: ${own.trim().slice(0, 60)}`);
        }
        for (const el of main.querySelectorAll("*")) {
          if (el.closest(skip)) continue;
          const cs = getComputedStyle(el);
          if (cs.textTransform === "uppercase" && (el.textContent ?? "").trim().length > 3 && !el.closest("[aria-hidden='true']")) out.push(`uppercase: ${(el.textContent ?? "").trim().slice(0, 40)}`);
          if (cs.backgroundImage.includes("gradient")) out.push(`gradient on <${el.tagName.toLowerCase()}>`);
          if (cs.backdropFilter && cs.backdropFilter !== "none") out.push(`backdrop-filter on <${el.tagName.toLowerCase()}>`);
        }
        return out;
      });
      expect(findings).toEqual([]);
    });
  }

  test("l'accueil ne garde que des icônes fonctionnelles (recherche) : aucune icône dans une liste ou une carte", async ({ page }) => {
    await page.goto("/");
    // Scenes and illustrations are large SVGs; an icon is small. Listing cards keep their favourite heart (a button).
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const svg of document.querySelectorAll("main li svg, main [data-slot='card'] svg, main dt svg, main h2 svg, main h3 svg")) {
        if (svg.closest('[data-testid="professional-card"], [role="search"], #exemple-evenement, [data-slot^="accordion"]')) continue;
        const r = svg.getBoundingClientRect();
        if (r.width <= 40) out.push(svg.outerHTML.slice(0, 80));
      }
      return out;
    });
    expect(small).toEqual([]);
  });
});
