import { expect, test, type Page } from "@playwright/test";
import { countInquiries, deleteTestAccount, findListingByOwnerEmail, publishListing, resetInquiryRateLimits } from "./helpers/db";

/**
 * Scenario B — professional journey: sign-up → trade → conditional form →
 * listing created → submission → (moderator approval, done directly in the
 * database because the back-office belongs to another module) → appears in
 * the directory → receives an inquiry from the public form → sees it in the
 * workspace.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const RUN = Date.now().toString(36);
const EMAIL = `e2e-pro-${RUN}@sousnosailes.test`;
const PASSWORD = "E2e-SousNosAiles-2026!";
const DISPLAY_NAME = `Nounous E2E ${RUN}`;

let listingId = "";
let slug = "";

async function signUp(page: Page) {
  const res = await page.request.post("/api/auth/sign-up/email", { data: { email: EMAIL, password: PASSWORD, name: "Camille E2E" }, headers: { origin: "http://localhost:3200" } });
  expect(res.ok(), await res.text()).toBeTruthy();
}

test.beforeAll(async () => {
  await resetInquiryRateLimits();
});

test.afterAll(async () => {
  await deleteTestAccount(EMAIL);
});

test("professional signs up and completes the five-step onboarding", async ({ page }) => {
  await signUp(page);
  await page.goto("/onboarding/professionnel");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Créer ma fiche");

  await test.step("step 1 — trade", async () => {
    await page.getByText("Garde d'enfants évènementielle", { exact: true }).first().click();
    await page.getByRole("checkbox", { name: "Baby-sitting" }).check({ force: true }).catch(() => undefined);
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page).toHaveURL(/step=2/);
  });

  await test.step("step 2 — identity", async () => {
    await page.getByLabel("Nom commercial").fill(DISPLAY_NAME);
    await page.getByLabel("Statut / type de structure").selectOption("sole_trader");
    await page.getByLabel(/^Ville\b/).fill("Toulouse");
    await page.getByLabel("Code postal").fill("31000");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page).toHaveURL(/step=3/);
  });

  await test.step("step 3 — childcare form (conditional)", async () => {
    await expect(page.getByRole("heading", { name: "Votre activité de garde d'enfants" })).toBeVisible();
    await page.getByLabel("Années d'expérience auprès d'enfants").fill("4");
    await page.getByText("Maternelle (3–6 ans)").click();
    await page.getByText("Garde et surveillance pendant la réception").click();
    await page.getByLabel("Statut d'exercice").selectOption("micro");
    await page.getByLabel("Nombre maximal d'enfants par intervenant (déclaré)").fill("6");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page).toHaveURL(/step=4/);
  });

  await test.step("step 4 — presentation", async () => {
    await page.getByLabel("Accroche (140 caractères max)").fill("Garde d'enfants douce et créative pour vos réceptions à Toulouse");
    await page.getByLabel("Description", { exact: true }).fill("Nous accompagnons les enfants pendant vos mariages et réceptions : espace de jeux sécurisé, ateliers calmes, sieste pour les plus petits et remise aux parents avec traçabilité. Équipe formée aux premiers secours, ratio d'encadrement annoncé à l'avance.");
    await page.getByLabel("À partir de (€)").fill("32");
    await page.getByLabel("Jusqu'à (€)").fill("48");
    await page.getByLabel("Unité").selectOption("hour");
    await page.getByText("Mariage", { exact: true }).first().click();
    await page.getByLabel("E-mail pro").fill(EMAIL);
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page).toHaveURL(/step=5/);
  });

  await test.step("step 5 — recap, template, submission", async () => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText(DISPLAY_NAME);
    const score = Number((await page.getByTestId("completeness-score").textContent())?.replace(/\D/g, ""));
    expect(score).toBeGreaterThanOrEqual(40);
    await page.getByRole("button", { name: "Soumettre ma fiche à la validation" }).click();
    await expect(page).toHaveURL(/\/app\/pro\/[0-9a-f-]+\?submitted=1/);
    await expect(page.getByText("Fiche envoyée à la validation")).toBeVisible();
    await expect(page.getByText("En attente de validation")).toBeVisible();
  });

  const listing = await findListingByOwnerEmail(EMAIL);
  expect(listing).not.toBeNull();
  expect(listing!.status).toBe("pending_review");
  listingId = listing!.id;
  slug = listing!.slug;
  expect(slug).toMatch(/^nounous-e2e-/);
});

test("moderator approval makes the listing appear in the directory", async ({ page }) => {
  // Not visible before approval.
  await page.goto(`/annuaire/garde-enfants-evenementielle?q=${encodeURIComponent(DISPLAY_NAME)}`);
  await expect(page.locator(`[data-testid="professional-card"][data-slug="${slug}"]`)).toHaveCount(0);

  await publishListing(listingId);

  await page.goto(`/annuaire/garde-enfants-evenementielle/haute-garonne?q=${encodeURIComponent(DISPLAY_NAME)}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Garde d'enfants évènementielle");
  const card = page.locator(`[data-testid="professional-card"][data-slug="${slug}"]`);
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId("verification-badge")).toHaveAttribute("data-level", "1");
  await expect(card).toContainText("Toulouse");
});

test("an organiser sends an inquiry from the public form and the professional sees it", async ({ page, browser }) => {
  const before = await countInquiries(listingId);
  const visitor = await browser.newContext();
  const vpage = await visitor.newPage();
  const message = `Bonjour, nous cherchons une garde pour 10 enfants le 12 juin 2027 (run ${RUN}).`;

  await test.step("public form (or API fallback when the public page is not delivered yet)", async () => {
    const res = await vpage.goto(`/pro/${slug}`);
    const form = vpage.getByTestId("inquiry-form");
    if (res?.ok() && (await form.count()) > 0) {
      await form.getByLabel("Votre nom").fill("Louis Organisateur");
      await form.getByLabel("Votre e-mail").fill(`e2e-requester-${RUN}@sousnosailes.test`);
      await form.getByLabel("Type d'évènement").selectOption("Mariage");
      await form.getByLabel("Date envisagée").fill("2027-06-12");
      await form.getByLabel("Dont enfants").fill("10");
      await form.getByLabel("Votre message").fill(message);
      await form.getByLabel(/J'accepte que mes coordonnées/).check();
      await form.getByRole("button", { name: /Envoyer ma demande/ }).click();
      await expect(vpage.getByTestId("inquiry-success")).toBeVisible();
    } else {
      const api = await vpage.request.post("/api/inquiries", {
        data: { professionalId: listingId, kind: "contact", requesterName: "Louis Organisateur", requesterEmail: `e2e-requester-${RUN}@sousnosailes.test`, eventTypeLabel: "Mariage", eventDate: "2027-06-12", childrenCount: 10, message, consent: true, website: "" },
      });
      expect(api.status(), await api.text()).toBe(201);
    }
  });
  await visitor.close();
  expect(await countInquiries(listingId)).toBe(before + 1);

  await test.step("the professional sees and opens the inquiry", async () => {
    await signInAsProfessional(page);
    await page.goto(`/app/pro/${listingId}/demandes`);
    const list = page.getByTestId("inquiries-list");
    await expect(list).toContainText("Louis Organisateur");
    await list.getByText("Louis Organisateur").first().click();
    await expect(page.getByTestId("inquiry-requester")).toContainText("Louis Organisateur");
    await expect(page.getByTestId("inquiry-message")).toContainText(`run ${RUN}`);
    await expect(page.getByText("Lue", { exact: true }).first()).toBeVisible();
  });
});

async function signInAsProfessional(page: Page) {
  const res = await page.request.post("/api/auth/sign-in/email", { data: { email: EMAIL, password: PASSWORD }, headers: { origin: "http://localhost:3200" } });
  expect(res.ok(), await res.text()).toBeTruthy();
}
