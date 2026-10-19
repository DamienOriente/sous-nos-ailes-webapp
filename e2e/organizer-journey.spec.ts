import { execFileSync } from "node:child_process";
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * Scenario A: organiser journey (steps 1 → 10):
 * sign-up → organiser onboarding → workspace created (checklist, channels) →
 * directory search → listing → inquiry → secure provider invitation → acceptance
 * in a second browser context (marie.garde@sousnosailes.test) → explicit
 * permission → message exchange → planning.
 *
 * Runs against the dev/preview server (E2E_NO_SERVER=1 to reuse it). Needs the
 * demo seed (Marie's account) and Mailpit on http://localhost:8027.
 */
const DEMO_PASSWORD = "Demo-SousNosAiles-2026!";
const MARIE_EMAIL = "marie.garde@sousnosailes.test";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8027";

const run = Date.now().toString(36);
const organizer = { email: `e2e-orga-${run}@sousnosailes.test`, password: `E2e-Organizer-${run}!`, name: "Louise Organisatrice" };

async function signUp(request: APIRequestContext, baseURL: string) {
  const res = await request.post(`${baseURL}/api/auth/sign-up/email`, { data: { email: organizer.email, password: organizer.password, name: organizer.name }, headers: { Origin: baseURL } });
  expect(res.ok(), `sign-up failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

async function signIn(context: BrowserContext, baseURL: string, email: string, password: string) {
  const res = await context.request.post(`${baseURL}/api/auth/sign-in/email`, { data: { email, password }, headers: { Origin: baseURL } });
  expect(res.ok(), `sign-in failed for ${email}: ${res.status()}`).toBeTruthy();
}

/** The outbox is drained by the worker in real life; here we drain it in-process so the e-mail lands in Mailpit. */
function drainOutbox() {
  execFileSync("pnpm", ["exec", "tsx", "-e", 'import("./src/modules/notifications/application/email-outbox.ts").then((m) => m.drainEmailOutbox(50)).then((r) => { console.log(JSON.stringify(r)); process.exit(0); })'], { stdio: "pipe", timeout: 60_000 });
}

async function invitationLinkFromMailpit(request: APIRequestContext, to: string): Promise<string> {
  for (let i = 0; i < 10; i += 1) {
    const list = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=5`);
    if (list.ok()) {
      const json = (await list.json()) as { messages?: Array<{ ID: string; Subject: string; Created: string }> };
      const msg = (json.messages ?? []).find((m) => m.Subject.includes("vous invite"));
      if (msg) {
        const body = await request.get(`${MAILPIT}/api/v1/message/${msg.ID}`);
        const detail = (await body.json()) as { HTML?: string; Text?: string };
        const haystack = `${detail.HTML ?? ""}\n${detail.Text ?? ""}`;
        const m = /https?:\/\/[^"'\s<]+\/app\/invitations\/([A-Za-z0-9_-]+)/.exec(haystack);
        if (m) return m[0].replace(/&amp;/g, "&");
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No invitation e-mail for ${to} in Mailpit`);
}

async function openSecondUser(browser: Browser, baseURL: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await signIn(context, baseURL, MARIE_EMAIL, DEMO_PASSWORD);
  const page = await context.newPage();
  return { context, page };
}

test.describe.configure({ mode: "serial" });

test("organiser journey: onboarding → provider invitation → coordination", async ({ page, browser, baseURL }) => {
  test.setTimeout(240_000);
  const base = baseURL ?? "http://localhost:3200";

  await test.step("1. sign-up", async () => {
    await signUp(page.context().request, base);
    await signIn(page.context(), base, organizer.email, organizer.password);
  });

  let eventId = "";
  await test.step("2–3. organiser onboarding creates the workspace", async () => {
    await page.goto("/onboarding/organisateur");
    await expect(page.getByRole("heading", { name: "Préparons votre évènement" })).toBeVisible();
    await page.getByRole("radio", { name: "Mariage" }).click();
    await page.getByLabel("Prénom de votre partenaire").fill("Lisa");
    await expect(page.getByLabel("Nom de l'évènement")).toHaveValue("Mariage de Louise et Lisa");
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Date prévue").fill("2027-06-12");
    await page.getByLabel("Ville").fill("Toulouse");
    await page.getByLabel("Code postal").fill("31000");
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Invités (approx.)").fill("90");
    await page.getByLabel("Enfants (approx.)").fill("12");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByRole("checkbox", { name: "Garde d'enfants évènementielle" })).toBeChecked();
    await page.getByRole("button", { name: "Créer mon espace" }).click();
    await page.waitForURL(/\/app\/evenements\/[0-9a-f-]{36}\?nouveau=1/);
    eventId = /\/app\/evenements\/([0-9a-f-]{36})/.exec(page.url())![1]!;
    await expect(page.getByText("Votre espace est prêt")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mariage de Louise et Lisa" })).toBeVisible();
    await expect(page.getByText("Premiers professionnels pour vous")).toBeVisible();
    // Checklist and general channel were generated.
    await page.goto(`/app/evenements/${eventId}/taches`);
    await expect(page.getByText(/\d+ \/ \d+ tâches terminées/)).toBeVisible();
    await expect(page.getByText("Réserver une garde d'enfants ou une animation")).toBeVisible();
    await page.goto(`/app/evenements/${eventId}/messages`);
    await expect(page.getByRole("heading", { name: "#Général" })).toBeVisible();
    await expect(page.getByText("Les organisateurs de l'évènement peuvent lire tous les échanges de cet espace.").first()).toBeVisible();
  });

  await test.step("4–6. directory search, listing, inquiry (directory module)", async () => {
    await page.goto(`/annuaire/garde-enfants-evenementielle?department=31&event=${eventId}`);
    const listing = page.locator('a[href^="/pro/"]').first();
    if ((await listing.count()) === 0) {
      test.info().annotations.push({ type: "skipped-step", description: "No published listing in the directory for this category." });
      return;
    }
    await listing.click();
    await page.waitForURL(/\/pro\//);
    const inquiryTrigger = page.getByRole("button", { name: /demande|contacter|devis/i }).first();
    if ((await inquiryTrigger.count()) > 0) {
      await inquiryTrigger.click();
      const message = page.getByLabel(/message/i).first();
      if ((await message.count()) > 0) {
        await message.fill("Bonjour, nous cherchons une garde d'enfants pour 12 enfants le 12 juin 2027 à Toulouse.");
        const send = page.getByRole("button", { name: /envoyer/i }).first();
        if ((await send.count()) > 0) await send.click();
      }
    }
  });

  let inviteUrl = "";
  await test.step("7. invite the provider with a secure link", async () => {
    await page.goto(`/app/evenements/${eventId}/prestataires`);
    await page.getByRole("button", { name: "Prestataire externe" }).click();
    const externalDialog = page.getByRole("dialog", { name: "Ajouter un prestataire externe" });
    await externalDialog.getByLabel("Nom ou raison sociale").fill("Marie Delcourt");
    await externalDialog.getByLabel("E-mail").fill(MARIE_EMAIL);
    await externalDialog.getByRole("button", { name: "Ajouter", exact: true }).click();
    await page.waitForURL(/\/prestataires\/[0-9a-f-]{36}/);
    await page.getByRole("button", { name: "Inviter par lien sécurisé" }).click();
    const inviteDialog = page.getByRole("dialog", { name: "Inviter dans l'équipe" });
    await expect(inviteDialog.getByLabel("E-mail")).toHaveValue(MARIE_EMAIL);
    await inviteDialog.getByRole("button", { name: "Envoyer l'invitation" }).click();
    await expect(page.getByText(/invitation en attente|Invitation envoyée/i).first()).toBeVisible();
    drainOutbox();
    inviteUrl = await invitationLinkFromMailpit(page.context().request, MARIE_EMAIL);
    expect(inviteUrl).toContain("/app/invitations/");
  });

  const marie = await openSecondUser(browser, base);
  await test.step("8. the provider accepts in a second browser context", async () => {
    await marie.page.goto(new URL(inviteUrl).pathname);
    await expect(marie.page.getByText("vous invite à rejoindre l'espace de coordination")).toBeVisible();
    await expect(marie.page.getByText("Mariage de Louise et Lisa")).toBeVisible();
    await marie.page.getByRole("button", { name: "Accepter l'invitation" }).click();
    await marie.page.waitForURL(new RegExp(`/app/evenements/${eventId}`));
    await expect(marie.page.getByRole("heading", { name: "Mariage de Louise et Lisa" })).toBeVisible();
    // A provider never sees the budget tab.
    await expect(marie.page.getByRole("link", { name: "Budget" })).toHaveCount(0);
    await expect(marie.page.getByRole("link", { name: "Planning", exact: true })).toBeVisible();
    // The link is single use.
    const again = await marie.context.request.get(`${base}${new URL(inviteUrl).pathname}`);
    expect(await again.text()).toContain("Invitation indisponible");
  });

  await test.step("9. assign an explicit permission, then exchange messages", async () => {
    await page.goto(`/app/evenements/${eventId}/equipe`);
    await expect(page.getByText("Marie Delcourt")).toBeVisible();
    const marieRow = page.locator("li", { hasText: "Marie Delcourt" }).first();
    await marieRow.getByRole("button", { name: "Permissions" }).click();
    const row = page.locator("li", { hasText: "Voir le budget" }).first();
    await row.getByRole("button", { name: "Autoriser" }).click();
    await expect(page.getByText("Permission mise à jour.")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto(`/app/evenements/${eventId}/equipe?onglet=journal`);
    await expect(page.getByText("Permission explicite définie").first()).toBeVisible();
    // Effective immediately for Marie.
    await marie.page.goto(`/app/evenements/${eventId}/budget`);
    await expect(marie.page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();

    await page.goto(`/app/evenements/${eventId}/messages`);
    await page.getByLabel("Votre message").fill("Bonjour @Marie, bienvenue ! Le planning est en ligne.");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("Bonjour @Marie, bienvenue !")).toBeVisible();
    await marie.page.goto(`/app/evenements/${eventId}/messages`);
    await expect(marie.page.getByText("Bonjour @Marie, bienvenue !")).toBeVisible();
    await marie.page.getByLabel("Votre message").fill("Merci Louise ! Je regarde le planning tout de suite.");
    await marie.page.getByRole("button", { name: "Envoyer" }).click();
    await expect(marie.page.getByText("Je regarde le planning tout de suite.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Je regarde le planning tout de suite.")).toBeVisible();
  });

  await test.step("10. planning: organiser adds a milestone, provider sees it and the ICS export works", async () => {
    await page.goto(`/app/evenements/${eventId}/planning`);
    await page.getByRole("button", { name: "Ajouter une étape" }).click();
    await page.getByLabel("Titre").fill("Goûter des enfants");
    await page.getByLabel("Début").fill("16:30");
    await page.getByLabel("Fin (optionnel)").fill("17:15");
    await page.getByLabel("Lieu précis").fill("La grange");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Goûter des enfants" })).toBeVisible();
    await marie.page.goto(`/app/evenements/${eventId}/planning`);
    await expect(marie.page.getByRole("heading", { name: "Goûter des enfants" })).toBeVisible();
    const ics = await marie.context.request.get(`${base}/app/evenements/${eventId}/planning/ics`);
    expect(ics.ok()).toBeTruthy();
    expect(ics.headers()["content-type"]).toContain("text/calendar");
    expect(await ics.text()).toContain("SUMMARY:Goûter des enfants");
  });

  await marie.context.close();
});
