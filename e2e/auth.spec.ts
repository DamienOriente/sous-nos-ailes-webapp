import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * Identity module journey, run against the local stack (dev server + Mailpit).
 * Serial: the account created in the first test is reused by the next ones.
 * better-auth rate-limits /sign-in/email to 5 calls per minute per IP, so the
 * sign-in helper waits for the countdown shown by the UI before retrying.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8027";
const RUN = Date.now().toString(36);
const EMAIL = `e2e-auth-${RUN}@sousnosailes.test`;
const PASSWORD = "E2e-SousNosAiles-2026!";
const NEW_PASSWORD = "E2e-NouveauMotDePasse-77!";

// ── helpers ──────────────────────────────────────────────────────────────────
type MailpitMessage = { ID: string; Subject: string; To: { Address: string }[] };

async function findMail(to: string, subjectPart: string): Promise<{ text: string; html: string }> {
  let found: MailpitMessage | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
        const json = (await res.json()) as { messages: MailpitMessage[] };
        found = json.messages.find((m) => m.Subject.includes(subjectPart));
        return Boolean(found);
      },
      { timeout: 30_000, message: `mail "${subjectPart}" to ${to}` },
    )
    .toBe(true);
  const res = await fetch(`${MAILPIT}/api/v1/message/${found!.ID}`);
  const json = (await res.json()) as { Text: string; HTML: string };
  return { text: json.Text ?? "", html: json.HTML ?? "" };
}

function extractLink(mail: { text: string; html: string }, pathPart: string): string {
  const re = new RegExp(`https?://[^\\s"'<>]*${pathPart.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[^\\s"'<>]*`);
  const match = mail.text.match(re) ?? mail.html.match(re);
  if (!match) throw new Error(`no link containing ${pathPart} in mail`);
  return match[0].replace(/&amp;/g, "&");
}

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const c of clean) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238, SHA-1, 30 s, 6 digits (better-auth defaults). */
function totp(secret: string, at = Date.now()): string {
  const counter = Math.floor(at / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
  return (code % 1_000_000).toString().padStart(6, "0");
}

async function waitForRateLimitToClear(page: Page) {
  const notice = page.getByText(/Trop de tentatives/);
  if (await notice.isVisible().catch(() => false)) {
    await expect(notice).toBeHidden({ timeout: 90_000 });
  }
}

/** Submits the sign-in form once (does not assert the outcome). */
async function submitSignIn(page: Page, email: string, password: string) {
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function signIn(page: Page, email: string, password: string, next = "/app") {
  await page.goto(`/connexion?next=${encodeURIComponent(next)}`);
  await waitForRateLimitToClear(page);
  await submitSignIn(page, email, password);
  // either we leave /connexion, or a rate-limit notice appears → wait and retry once
  await Promise.race([page.waitForURL((u) => !u.pathname.startsWith("/connexion") || u.pathname === "/connexion/verification"), page.getByText(/Trop de tentatives/).waitFor()]);
  if (page.url().includes("/connexion?") || page.url().endsWith("/connexion")) {
    await waitForRateLimitToClear(page);
    await submitSignIn(page, email, password);
    await page.waitForURL((u) => !u.pathname.startsWith("/connexion") || u.pathname === "/connexion/verification");
  }
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

// ── tests ────────────────────────────────────────────────────────────────────
test("inscription → e-mail de confirmation (Mailpit) → adresse vérifiée", async ({ page }) => {
  await page.goto("/inscription");
  await expect(page.getByRole("heading", { name: "Créer votre compte" })).toBeVisible();
  await page.getByLabel("Prénom").fill("Élodie");
  await page.getByLabel("Nom", { exact: true }).fill("Testeuse");
  await page.getByLabel("Adresse e-mail").fill(EMAIL);
  const pwd = page.getByLabel("Mot de passe", { exact: true });
  await pwd.fill("abc");
  await expect(page.getByText(/Robustesse : Trop faible|Robustesse : Faible/)).toBeVisible();
  await pwd.fill(PASSWORD);
  await expect(page.getByText(/Robustesse : Excellent/)).toBeVisible();
  await expect(pwd).toHaveAttribute("autocomplete", "new-password");

  // Terms are mandatory
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Vous devez accepter les conditions")).toBeVisible();
  await page.getByRole("checkbox", { name: /J'accepte les/ }).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await page.waitForURL("**/onboarding");
  await expect(page.getByRole("heading", { name: "Que souhaitez-vous faire en premier ?" })).toBeVisible();
  await expect(page.getByText("Bienvenue, Élodie")).toBeVisible();

  // Home shows the "verify your e-mail" banner until the link is clicked
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Bonjour Élodie" })).toBeVisible();
  await expect(page.getByText("Confirmez votre adresse e-mail")).toBeVisible();

  const mail = await findMail(EMAIL, "Confirmez votre adresse e-mail");
  const link = extractLink(mail, "/api/auth/verify-email");
  await page.goto(link);
  await page.waitForURL("**/verification-email?statut=ok");
  await expect(page.getByRole("heading", { name: "Adresse e-mail vérifiée" })).toBeVisible();

  await page.goto("/app");
  await expect(page.getByText("Confirmez votre adresse e-mail")).toHaveCount(0);
});

test("connexion avec ?next → changement de mot de passe → déconnexion → reconnexion", async ({ page }) => {
  // open redirect guard: an absolute destination is ignored
  await page.goto("/connexion?next=https://evil.example");
  await expect(page.getByRole("link", { name: "Créer un compte" })).toHaveAttribute("href", "/inscription?next=%2Fapp");

  await signIn(page, EMAIL, PASSWORD, "/app/compte/securite");
  await expect(page).toHaveURL(/\/app\/compte\/securite$/);
  await expect(page.getByRole("heading", { name: "Mot de passe", exact: true })).toBeVisible();

  await page.getByLabel("Mot de passe actuel").fill(PASSWORD);
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Confirmer le nouveau mot de passe").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.getByText(/Mot de passe modifié/).first()).toBeVisible();
  // journal
  await page.reload();
  await expect(page.getByRole("region", { name: "Activité récente" }).getByRole("list")).toContainText("Mot de passe modifié");
  // sessions list shows the current device
  await expect(page.getByText("Cet appareil")).toBeVisible();

  await signOut(page);

  // old password refused with a generic message
  await page.goto("/connexion");
  await waitForRateLimitToClear(page);
  await submitSignIn(page, EMAIL, PASSWORD);
  await expect(page.getByRole("alert").filter({ hasText: /Identifiants incorrects|Trop de tentatives/ })).toBeVisible();

  await signIn(page, EMAIL, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/app$/);
});

test("double authentification TOTP : activation, connexion en deux étapes, code de secours, désactivation", async ({ page }) => {
  await signIn(page, EMAIL, NEW_PASSWORD, "/app/compte/securite");
  await page.getByRole("button", { name: "Activer la double authentification" }).click();
  await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByAltText(/QR code/)).toBeVisible();
  const secret = (await page.locator("code").first().innerText()).replace(/\s+/g, "");
  expect(secret.length).toBeGreaterThan(10);
  await page.getByLabel("Code de vérification").fill(totp(secret));
  await page.getByRole("button", { name: "Confirmer l'activation" }).click();

  await expect(page.getByText(/vos codes de secours/)).toBeVisible();
  const backupCodes = await page.getByRole("list", { name: "Codes de secours" }).locator("li").allInnerTexts();
  expect(backupCodes.length).toBeGreaterThanOrEqual(8);
  await page.getByLabel("J'ai enregistré mes codes de secours en lieu sûr.").check();
  await page.getByRole("button", { name: "Terminer" }).click();
  await expect(page.getByText("Activée", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Activité récente" }).getByRole("list")).toContainText("Double authentification activée");

  // Sign-in now requires the second step
  await signOut(page);
  await signIn(page, EMAIL, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/connexion\/verification$/);
  const codeField = page.getByLabel("Code à 6 chiffres");
  await expect(codeField).toHaveAttribute("autocomplete", "one-time-code");
  await codeField.fill("000000");
  await page.getByRole("button", { name: "Vérifier" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Code incorrect|Trop de tentatives/ })).toBeVisible();
  await codeField.fill(totp(secret));
  await page.getByRole("button", { name: "Vérifier" }).click();
  await page.waitForURL("**/app");

  // Backup code path
  await signOut(page);
  await signIn(page, EMAIL, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/connexion\/verification$/);
  await page.getByRole("button", { name: "Utiliser un code de secours" }).click();
  await page.getByLabel("Code de secours").fill(backupCodes[0]!);
  await page.getByRole("button", { name: "Vérifier" }).click();
  await page.waitForURL("**/app");

  // Disable
  await page.goto("/app/compte/securite");
  await page.getByRole("button", { name: "Désactiver" }).click();
  await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Désactivée", { exact: true })).toBeVisible();
});

test("profil, préférences de notification et onboarding", async ({ page }) => {
  await signIn(page, EMAIL, NEW_PASSWORD, "/app/compte");
  await page.getByLabel("Ville (facultatif)").fill("Toulouse");
  await page.getByLabel("Code postal").fill("31000");
  await page.getByLabel("Téléphone (facultatif)").fill("06 12 34 56 78");
  await page.getByLabel("Fuseau horaire").selectOption("Europe/Brussels");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Profil enregistré.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Ville (facultatif)")).toHaveValue("Toulouse");
  await expect(page.getByLabel("Fuseau horaire")).toHaveValue("Europe/Brussels");

  await page.goto("/app/compte/notifications");
  await page.getByRole("radio", { name: /Résumé quotidien/ }).check();
  await page.getByRole("switch", { name: "Échéances" }).click();
  await page.getByRole("switch", { name: "Nouveautés et conseils par e-mail" }).click();
  await page.getByRole("button", { name: "Enregistrer mes préférences" }).click();
  await expect(page.getByText("Préférences enregistrées.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: /Résumé quotidien/ })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Échéances" })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("switch", { name: "Nouveautés et conseils par e-mail" })).toHaveAttribute("aria-checked", "true");

  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Créer ma fiche pro" }).click();
  await page.waitForURL("**/onboarding/professionnel");
});

test("mot de passe oublié → lien Mailpit → réinitialisation", async ({ page }) => {
  await page.goto("/mot-de-passe-oublie");
  await page.getByLabel("Adresse e-mail du compte").fill(EMAIL);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByText(/Si un compte existe pour/)).toBeVisible();

  const mail = await findMail(EMAIL, "Réinitialisation de votre mot de passe");
  const link = extractLink(mail, "/api/auth/reset-password/");
  await page.goto(link);
  await page.waitForURL(/\/reinitialiser\?token=/);
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Enregistrer le nouveau mot de passe" }).click();
  await page.waitForURL("**/connexion?message=mot-de-passe-reinitialise");
  await expect(page.getByText("Votre mot de passe a été réinitialisé")).toBeVisible();

  // A used token is refused
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Lien invalide" })).toBeVisible();
});

// Outside production the sign-in limit is 300/min so suites can run; set AUTH_RATE_LIMIT_STRICT=true on the server to exercise the 429 path.
test("6 mauvais mots de passe → limite 429 visible avec compte à rebours", async ({ page }) => {
  test.skip(process.env.E2E_STRICT_RATE_LIMIT !== "1", "needs AUTH_RATE_LIMIT_STRICT=true on the server");
  await page.goto("/connexion");
  await waitForRateLimitToClear(page);
  const notice = page.getByText(/Trop de tentatives. Vous pourrez réessayer dans/);
  const formAlert = page.getByRole("alert").filter({ hasText: /Identifiants incorrects|Trop de tentatives/ });
  let limited = false;
  for (let attempt = 1; attempt <= 8 && !limited; attempt++) {
    await page.getByLabel("Adresse e-mail").fill(EMAIL);
    await page.getByLabel("Mot de passe", { exact: true }).fill(`wrong-password-${attempt}`);
    const [response] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/auth/sign-in/email")), page.getByRole("button", { name: "Se connecter" }).click()]);
    expect([401, 429]).toContain(response.status());
    if (response.status() === 429) {
      limited = true;
      expect(Number(response.headers()["x-retry-after"])).toBeGreaterThan(0);
    } else {
      await expect(formAlert).toHaveText("Identifiants incorrects.");
    }
  }
  expect(limited).toBe(true);
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/\d+ s/);
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeDisabled();
});
