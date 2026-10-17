import { expect, type Page } from "@playwright/test";

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export const DEMO = {
  admin: { email: "marie@example.test", password: "demo-marie-2026" },
  client1: { email: "camille.durand@example.test", password: "demo-client-2026" },
  client2: { email: "thomas.lefevre@example.test", password: "demo-client-2026" },
  providerAlix: { email: "alix.moreau@example.test", password: "demo-intervenant-2026" },
  providerChloe: { email: "chloe.garnier@example.test", password: "demo-intervenant-2026" },
  providerDorian: { email: "dorian.robin@example.test", password: "demo-intervenant-2026" },
  partner: { email: "contact@domaine-des-tilleuls.example.test", password: "demo-partenaire-2026" },
} as const;

export async function login(page: Page, account: { email: string; password: string }, expectedPathPrefix: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse email").last().fill(account.email);
  await page.getByLabel("Mot de passe").fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(new RegExp(`^${BASE_URL}${expectedPathPrefix}`));
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
}

const MAILPIT = "http://localhost:8026/api/v1";

export async function searchMail(query: string): Promise<Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }>> {
  const response = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(query)}&limit=20`);
  if (!response.ok) throw new Error(`Mailpit search failed: ${response.status}`);
  const data = (await response.json()) as { messages: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }> };
  return data.messages;
}

export async function readMail(id: string): Promise<{ Text: string; HTML: string }> {
  const response = await fetch(`${MAILPIT}/message/${id}`);
  if (!response.ok) throw new Error(`Mailpit message failed: ${response.status}`);
  return (await response.json()) as { Text: string; HTML: string };
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@example.test`;
}
