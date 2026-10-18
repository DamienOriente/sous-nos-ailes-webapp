import { expect, test } from "@playwright/test";
import { closeFixtures, createGuest, deleteGuestsByLastName, deleteInvitationsByRecipient, ensureFixtureEvent, login } from "./support/guests-fixtures";

/**
 * Scénario A, étapes 11-13 : l'organisateur crée une invitation, génère le QR
 * code, le staff valide le code (accepté puis déjà utilisé) ; puis réponse RSVP
 * publique via le lien, sans compte.
 */
let eventId: string;
let guestId: string;

test.beforeAll(async () => {
  ({ eventId } = await ensureFixtureEvent());
  await deleteInvitationsByRecipient(eventId, "E2E ");
  await deleteGuestsByLastName(eventId, "E2E-Invité");
  guestId = await createGuest(eventId, "Pauline", "E2E-Invité", { plusOnes: 1 });
});

test.afterAll(async () => {
  await deleteInvitationsByRecipient(eventId, "E2E ");
  await deleteGuestsByLastName(eventId, "E2E-Invité");
  await closeFixtures();
});

test("créer une invitation, générer le QR, valider côté staff (accepté puis déjà utilisé), répondre via le lien public", async ({ page, browser }) => {
  // Capture clipboard writes so the RSVP link can be read back without a real clipboard.
  await page.addInitScript(() => {
    (window as unknown as { __copied?: string }).__copied = undefined;
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t: string) => void ((window as unknown as { __copied?: string }).__copied = t) }, configurable: true });
  });
  await login(page, "louis@sousnosailes.test");

  // 11. Create the invitation
  await page.goto(`/app/evenements/${eventId}/invitations/nouvelle`);
  await expect(page.getByRole("heading", { name: "Nouvelle invitation" })).toBeVisible();
  await page.getByLabel("Nom du destinataire *").fill("E2E Pauline");
  await page.getByLabel("E-mail (pour l'envoi)").fill("pauline.e2e@example.test");
  await page.getByRole("radio", { name: /Pauline E2E-Invité/ }).check();
  await page.getByRole("button", { name: "Créer l'invitation" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/evenements/${eventId}/invitations/[0-9a-f-]{36}$`));
  await expect(page.getByRole("heading", { name: "E2E Pauline" })).toBeVisible();
  await expect(page.getByText("Brouillon")).toBeVisible();
  const invitationUrl = page.url();
  void guestId;

  // 12. Generate the QR code (premium) and read the encoded URL
  await page.getByTestId("generate-qr").click();
  await expect(page.getByTestId("qr-image")).toBeVisible();
  const qrUrl = (await page.getByTestId("qr-url").textContent())?.trim() ?? "";
  expect(qrUrl).toMatch(/\/c\/[A-Za-z0-9_-]{20,}$/);
  // The QR must not carry personal data.
  expect(qrUrl.toLowerCase()).not.toContain("pauline");

  // Copy the RSVP link for step 13b
  await page.getByRole("button", { name: "Copier le lien RSVP" }).click();
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __copied?: string }).__copied)).toMatch(/\/invitation\/[A-Za-z0-9_-]{20,}$/);
  const rsvpLink = (await page.evaluate(() => (window as unknown as { __copied?: string }).__copied)) as string;

  // 13. Staff check-in: manual entry → accepted, then duplicate
  await page.goto(`/app/evenements/${eventId}/checkin`);
  await page.getByLabel("Code d'accès").fill(qrUrl);
  await page.getByTestId("checkin-submit").click();
  const result = page.getByTestId("checkin-result");
  await expect(result).toHaveAttribute("data-result", "accepted");
  await expect(result).toContainText("Invitation valide : vérifiez l'identité si nécessaire");
  await expect(result).toContainText("E2E Pauline");
  await page.getByLabel("Code d'accès").fill(qrUrl);
  await page.getByTestId("checkin-submit").click();
  await expect(result).toHaveAttribute("data-result", "duplicate");
  await expect(result).toContainText("Déjà utilisée");
  await expect(page.getByTestId("checkin-history")).toContainText("E2E Pauline");

  // 13b. Public RSVP without any session
  const anonymous = await browser.newContext({ locale: "fr-FR" });
  const pub = await anonymous.newPage();
  const res = await pub.goto(rsvpLink);
  expect(res?.status()).toBe(200);
  await expect(pub.getByRole("heading", { name: "Serez-vous des nôtres ?" })).toBeVisible();
  await expect(pub.getByText("E2E Pauline,")).toBeVisible();
  await pub.getByText("Je serai présent(e)").click();
  await pub.getByLabel(/Accompagnant\(s\) supplémentaire/).fill("1");
  await expect(pub.getByText("Total annoncé : 2 personne(s)")).toBeVisible();
  await pub.getByLabel("Un petit mot pour l'organisateur (facultatif)").fill("Merci, à très vite !");
  await pub.getByRole("button", { name: "Envoyer ma réponse" }).click();
  await expect(pub.getByText("Merci, votre réponse a bien été enregistrée.")).toBeVisible();
  // Never indexed
  const robots = await pub.locator('meta[name="robots"]').getAttribute("content");
  expect(robots ?? "").toContain("noindex");
  await anonymous.close();

  // The organiser sees the answer
  await page.goto(invitationUrl);
  await expect(page.getByText("Répondue").first()).toBeVisible();
  await expect(page.getByText("2 personne(s)")).toBeVisible();
  await expect(page.getByText("Merci, à très vite !")).toBeVisible();

  // Invalid / unknown token page is explicit
  const bad = await page.goto("/invitation/ceci-nest-pas-un-token-valide-0000");
  expect(bad?.status()).toBe(200);
  await expect(page.getByText("Invitation introuvable")).toBeVisible();
});
