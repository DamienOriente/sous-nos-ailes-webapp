import { expect, test, type Page } from "@playwright/test";
import { BASE_URL, DEMO, login, logout, readMail, searchMail, uniqueEmail } from "./helpers";

// End-to-end business journey on a fresh request (repeatable): proposal v1/v2,
// client agreement through the emailed login link, invitations (accept/decline),
// assignment, scheduling conflict, confirmation blocked then granted.

function parisDatePlusDays(days: number): string {
  const now = new Date(Date.now() + days * 24 * 60 * 60_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

async function submitFreshRequest(page: Page, email: string, date: string) {
  await page.goto("/demander-un-devis");
  await page.getByLabel("Fête privée", { exact: true }).check();
  await page.getByLabel("Date de l’événement").fill(date);
  await page.getByLabel("Début de la garde").fill("18:00");
  await page.getByLabel("Fin de la garde").fill("23:00");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Un autre lieu").check();
  await page.getByLabel("Nom ou type de lieu").fill("Maison familiale (test e2e)");
  await page.getByLabel("Commune").fill("Lyon");
  await page.getByLabel("Code postal").fill("69007");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("3 à 5 ans").fill("6");
  await page.getByLabel("6 à 10 ans").fill("8");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Votre nom").fill("Client Parcours");
  await page.getByLabel("Votre email").fill(email);
  await page.getByLabel(/J’ai pris connaissance de la/).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForTimeout(3200);
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();
  await expect(page).toHaveURL(/merci\?ref=LPI-/);
  return new URL(page.url()).searchParams.get("ref")!;
}

async function openEventAsAdmin(page: Page, reference: string): Promise<string> {
  await page.goto(`/admin/evenements?status=ALL&search=${encodeURIComponent(reference)}`);
  await page.getByRole("link", { name: new RegExp(reference) }).first().click();
  await page.waitForURL(/\/admin\/evenements\/[^/?]+/);
  await expect(page.getByText(reference).first()).toBeVisible();
  const url = new URL(page.url());
  return `${url.origin}${url.pathname}`;
}

test.describe.serial("Marie runs a file from request to confirmation", () => {
  const clientEmail = uniqueEmail("parcours");
  // A different evening on every run so that previous test runs (which leave assigned events behind)
  // never make the demo providers ineligible. The scheduling conflict is tested on seeded data in step 9.
  const eventDate = parisDatePlusDays(45 + (Math.floor(Date.now() / 1000) % 120));
  let reference = "";
  let eventUrl = "";

  test("1. a fresh request is created", async ({ page }) => {
    reference = await submitFreshRequest(page, clientEmail, eventDate);
    expect(reference).toMatch(/^LPI-\d{4}-\d{4}$/);
  });

  test("2–3. Marie finds the request, sends a proposal, then a revised version that keeps the first", async ({ page }) => {
    await login(page, DEMO.admin, "/admin");
    eventUrl = await openEventAsAdmin(page, reference);
    await expect(page.getByText("Nouvelle demande").first()).toBeVisible();

    await page.getByRole("button", { name: "Préparer une nouvelle version" }).click();
    await expect(page).toHaveURL(/\/propositions\/.+\/modifier$/);
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.getByText(/enregistré/i).first()).toBeVisible();
    await page.locator("summary", { hasText: "Transmettre au client" }).click();
    await page.getByRole("button", { name: /Transmettre la version \d+ au client/ }).click();
    await expect(page).toHaveURL(new RegExp(`^${eventUrl}(\\?.*)?$`));
    await expect(page.getByText("Proposition envoyée").first()).toBeVisible();
    await expect.poll(async () => (await searchMail(`to:${clientEmail} subject:proposition`)).length, { timeout: 15_000 }).toBeGreaterThan(0);

    // Revised version
    await page.getByRole("button", { name: "Préparer une nouvelle version" }).click();
    await page.getByLabel(/Titre/).first().fill(`Proposition révisée — ${reference}`);
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.getByText(/enregistré/i).first()).toBeVisible();
    await page.locator("summary", { hasText: "Transmettre au client" }).click();
    await page.getByRole("button", { name: /Transmettre la version \d+ au client/ }).click();
    await expect(page).toHaveURL(new RegExp(`^${eventUrl}(\\?.*)?$`));
    const main = page.locator("main");
    await expect(main.getByText("Remplacée").first()).toBeVisible();
    await expect(main.getByText("Transmise").first()).toBeVisible();
    await logout(page);
  });

  test("4–5. the client signs in through the emailed link and agrees in principle", async ({ page }) => {
    const messages = await searchMail(`to:${clientEmail}`);
    const ack = messages.find((m) => m.Subject.includes("est bien reçue"))!;
    const mail = await readMail(ack.ID);
    const link = mail.Text.match(/https?:\/\/localhost:3100\/connexion\/lien\/[A-Za-z0-9_-]+/)?.[0]?.replace("http://localhost:3100", BASE_URL);
    expect(link).toBeTruthy();
    await page.goto(link!);
    await page.getByRole("button", { name: "Confirmer ma connexion" }).click();
    await expect(page).toHaveURL(/\/espace-client/);
    await page.getByRole("link", { name: new RegExp(reference) }).first().click();
    await page.getByRole("button", { name: "Cette proposition me convient" }).click();
    await expect(page.getByText(/Accord de principe/).first()).toBeVisible();
    // The link is single-use
    await logout(page);
    await page.goto(link!);
    await page.getByRole("button", { name: "Confirmer ma connexion" }).click();
    await expect(page.getByText(/invalide, déjà utilisé ou expiré/)).toBeVisible();
  });

  test("6. Marie proposes the mission to two providers", async ({ page }) => {
    await login(page, DEMO.admin, "/admin");
    await page.goto(eventUrl);
    await expect(page.getByText("Accord de principe").first()).toBeVisible();
    await page.getByRole("button", { name: "Lancer la préparation" }).click();
    await expect(page.getByText("Préparation").first()).toBeVisible();
    // Let hydration settle before ticking: a node re-created by React would drop the checked state.
    await page.waitForLoadState("networkidle");
    for (const name of ["Dorian", "Chloé"]) {
      const box = page.getByRole("checkbox", { name: new RegExp(`Proposer à ${name}`) });
      await box.check();
      await expect(box).toBeChecked();
    }
    await page.getByRole("button", { name: /Proposer la mission/ }).click();
    await expect(page.getByText("En attente de réponse").first()).toBeVisible();
    await expect.poll(async () => (await searchMail("to:dorian.robin@example.test subject:mission")).length, { timeout: 15_000 }).toBeGreaterThan(0);
    await logout(page);
  });

  test("7. one provider accepts, another declines", async ({ page }) => {
    await login(page, DEMO.providerDorian, "/espace-intervenant");
    const dorianCard = page.locator("main").locator("article, section, li", { hasText: reference }).first();
    await dorianCard.getByRole("button", { name: "Accepter" }).click();
    await expect(page.locator("main").getByText(/Disponibilités transmises/).first()).toBeVisible();
    await logout(page);

    await login(page, DEMO.providerChloe, "/espace-intervenant");
    const chloeCard = page.locator("main").locator("article, section, li", { hasText: reference }).first();
    await chloeCard.getByRole("button", { name: "Refuser" }).click();
    await page.locator("summary", { hasText: "Historique" }).click();
    await expect(page.locator("main").getByText(/Refusée/).first()).toBeVisible();
    await logout(page);
  });

  test("8–9–11. Marie assigns the available person; the conflicting one is blocked; confirmation stays blocked while the team is incomplete", async ({ page }) => {
    await login(page, DEMO.admin, "/admin");
    await page.goto(eventUrl);
    const main = page.locator("main");
    // Assign Dorian
    const dorianRow = main.locator("li, tr, article", { hasText: "Dorian" }).filter({ hasText: /acceptée/i }).first();
    await dorianRow.getByRole("button", { name: /Affecter/ }).click();
    await expect(main.getByText(/Équipe incomplète/).first()).toBeVisible();
    // Confirmation blocked
    await expect(main.getByRole("button", { name: "Confirmer la prestation" })).toBeDisabled();
    await expect(main.getByText(/L’équipe nécessaire doit être acceptée et affectée au complet/)).toBeVisible();
  });

  test("9. a scheduling conflict blocks an assignment (seeded LPI-DEMO-0006 vs LPI-DEMO-0003)", async ({ page }) => {
    await login(page, DEMO.admin, "/admin");
    await openEventAsAdmin(page, "LPI-DEMO-0006");
    const main = page.locator("main");
    const alixRow = main.locator("li, tr, article", { hasText: "Alix" }).filter({ hasText: /acceptée/i }).first();
    await alixRow.getByRole("button", { name: /Affecter/ }).click();
    await expect(main.getByText(/conflit horaire|LPI-DEMO-0003/i).first()).toBeVisible();
    await expect(main.getByText(/Équipe à constituer|Équipe incomplète|Propositions en cours/).first()).toBeVisible();
  });

  test("12. with a complete team and validated operations, Marie confirms", async ({ page }) => {
    await login(page, DEMO.admin, "/admin");
    await page.goto(eventUrl);
    const main = page.locator("main");
    // Reduce the required team to the one person assigned (Marie's decision), validate operations, confirm.
    await main.getByLabel("Intervenant·es requis·es").first().fill("1");
    await main.getByLabel("Point de rendez-vous de l’équipe").first().fill("Portail, 17 h 30");
    await main.getByLabel("Contact opérationnel sur place").first().fill("Client Parcours");
    await main.getByLabel("Téléphone du contact").first().fill("06 00 00 00 99");
    await main.getByRole("button", { name: "Enregistrer la fiche" }).first().click();
    await expect(main.getByText(/Équipe complète/).first()).toBeVisible();
    await main.getByRole("button", { name: "Valider les points opérationnels" }).click();
    await expect(main.getByRole("button", { name: "Confirmer la prestation" })).toBeEnabled();
    await main.getByRole("button", { name: "Confirmer la prestation" }).click();
    await expect(main.getByText("Confirmée").first()).toBeVisible();
  });
});
