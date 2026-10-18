import { expect, test } from "@playwright/test";

/** Demo mode: every role opens in one click from /connexion, and the banner lets testers switch. */
test("connexion en un clic avec un compte de démonstration, puis changement de compte", async ({ page }) => {
  await page.goto("/connexion");
  const picker = page.getByRole("region", { name: "Se connecter avec un compte de démonstration" });
  await expect(picker).toBeVisible();

  await picker.getByRole("button", { name: /Louis Marchand/ }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole("link", { name: "Changer de compte" }).click();
  await expect(page).toHaveURL(/\/connexion\?changer=1$/);
  await page.getByRole("button", { name: /Modération SNA/ }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/connexion?changer=1");
  await page.getByRole("button", { name: /Marie Delcourt/ }).click();
  // An independent has one listing: /app/pro goes straight to it.
  await expect(page).toHaveURL(/\/app\/pro\/[0-9a-f-]{36}$/);
});

test("un compte de démonstration inconnu est refusé sans ouvrir de session", async ({ page }) => {
  await page.goto("/connexion");
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('button[name="account"]');
    if (button) button.value = "root";
  });
  await page.getByRole("button", { name: /Louis Marchand/ }).click();
  await expect(page).toHaveURL(/message=compte-demo-indisponible/);
  await expect(page.getByText("Ce compte de démonstration n'est pas disponible")).toBeVisible();
});
