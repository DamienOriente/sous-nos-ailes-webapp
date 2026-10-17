import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { calendarConnections, users } from "@/db/schema";
import { encryptText } from "@/lib/crypto";
import { closeDb, EMAILS, ensureDemoEvent, signIn } from "./_childcare-fixture";

test.beforeAll(async () => {
  await ensureDemoEvent();
});
test.afterAll(async () => {
  await closeDb();
});

test.describe("Calendrier", () => {
  test("Théo voit ses prestations, le conflit du 12 juin, crée puis supprime une entrée, exporte l'ICS", async ({ page }) => {
    await signIn(page, EMAILS.theo);
    await page.goto("/app/calendrier?view=month&date=2027-06-12");
    await expect(page.getByRole("heading", { name: "Calendrier" })).toBeVisible();
    await expect(page.getByText(/conflit/)).toBeVisible();
    await expect(page.getByTestId("calendar-occurrence").filter({ hasText: "DJ — Mariage Louis & Lisa" }).first()).toBeVisible();

    // Create an entry through the dialog.
    await page.getByRole("button", { name: "Nouvelle entrée" }).click();
    await page.getByLabel("Titre *").fill("Test E2E repérage");
    await page.getByLabel("Début *").fill("2027-06-20T10:00");
    await page.getByLabel("Fin *").fill("2027-06-20T11:00");
    await page.getByRole("button", { name: "Créer" }).click();
    await expect(page.getByTestId("calendar-occurrence").filter({ hasText: "Test E2E repérage" })).toBeVisible();

    // Open it, delete it.
    await page.getByTestId("calendar-occurrence").filter({ hasText: "Test E2E repérage" }).click();
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByTestId("calendar-occurrence").filter({ hasText: "Test E2E repérage" })).toHaveCount(0);

    // Agenda + day views and keyboard navigation.
    await page.goto("/app/calendrier?view=agenda&date=2027-06-10");
    await expect(page.getByRole("tab", { name: "Agenda" })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("1");
    await expect(page).toHaveURL(/view=day/);
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/date=2027-06-11/);

    // ICS export is authenticated and valid.
    const ics = await page.request.get("/api/calendar/ics");
    expect(ics.ok()).toBe(true);
    expect(ics.headers()["content-type"]).toContain("text/calendar");
    const body = await ics.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("DJ — Mariage Louis & Lisa");
  });

  test("Connexions : paywall pour un pro gratuit (Théo), état « non activée » et connexion expirée pour un organisateur", async ({ page }) => {
    // Théo owns a listing on the free plan → contextual paywall, no connector.
    await signIn(page, EMAILS.theo);
    await page.goto("/app/calendrier/connexions");
    await expect(page.getByText("Inclus dans Professionnel Premium").first()).toBeVisible();
    await expect(page.getByTestId("connection-google")).toHaveCount(0);

    // Louis (organiser, no listing): connectors are free; providers are not configured on this instance.
    // An expired Google connection is inserted for him to show the "reconnect" state.
    const [louis] = await db.select({ id: users.id }).from(users).where(eq(users.email, EMAILS.paul)).limit(1);
    await db
      .insert(calendarConnections)
      .values({ userId: louis!.id, provider: "google", externalAccountEmail: "louis@gmail.test", externalCalendarId: "primary", accessTokenEncrypted: encryptText("expired"), accessTokenExpiresAt: new Date(Date.now() - 86_400_000), status: "expired", syncDirection: "export_only", lastError: "Jeton expiré : reconnectez le calendrier." })
      .onConflictDoUpdate({ target: [calendarConnections.userId, calendarConnections.provider], set: { status: "expired", lastError: "Jeton expiré : reconnectez le calendrier." } });
    try {
      await signIn(page, EMAILS.paul);
      await page.goto("/app/calendrier/connexions");
      await expect(page.getByRole("heading", { name: /Connexions Google/ })).toBeVisible();
      await expect(page.getByTestId("connection-google")).toContainText("Jeton expiré");
      await expect(page.getByTestId("connection-google").getByRole("link", { name: "Reconnecter" })).toBeVisible();
      await expect(page.getByTestId("connection-microsoft")).toContainText("Intégration non activée");
    } finally {
      await db.delete(calendarConnections).where(and(eq(calendarConnections.userId, louis!.id), eq(calendarConnections.provider, "google")));
    }
  });

  test("Import ICS : fichier invalide rejeté, fichier valide prévisualisé puis importé", async ({ page }) => {
    await signIn(page, EMAILS.ines);
    await page.goto("/app/calendrier/import");
    await page.waitForLoadState("networkidle"); // the file input handler needs hydration
    await page.getByLabel("Fichier .ics (1 Mo max)").setInputFiles({ name: "bad.ics", mimeType: "text/calendar", buffer: Buffer.from("not a calendar") });
    await expect(page.getByRole("alert").filter({ hasText: /iCalendar/ })).toBeVisible();
    const runId = Date.now().toString(36);
    const title = `Shooting E2E importé ${runId}`;
    const valid = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//FR", "BEGIN:VEVENT", `UID:e2e-import-${runId}@test`, "DTSTAMP:20260101T000000Z", "DTSTART:20270703T090000Z", "DTEND:20270703T110000Z", `SUMMARY:${title}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    await page.getByLabel("Fichier .ics (1 Mo max)").setInputFiles({ name: "ok.ics", mimeType: "text/calendar", buffer: Buffer.from(valid) });
    await expect(page.getByText(title)).toBeVisible();
    await page.getByRole("button", { name: /Importer 1 évènement/ }).click();
    await expect(page).toHaveURL(/\/app\/calendrier\?view=agenda/);
    await page.goto("/app/calendrier?view=day&date=2027-07-03");
    await expect(page.getByTestId("calendar-occurrence").filter({ hasText: title })).toBeVisible();
  });
});
