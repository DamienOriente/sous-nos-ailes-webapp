import { configurationSettings } from "@/db/schema";
import type { SeedContext } from "./context";

/**
 * Compliance seed: configuration keys consumed by the public site. Values are
 * placeholders or demo addresses; the owner replaces them in the back-office.
 * Registered in seed/index.ts under the name "legal" (coordinator diff).
 */
export async function seed(ctx: SeedContext): Promise<void> {
  const settings: Array<{ key: string; value: unknown; description: string }> = [
    { key: "legal.contact_email", value: "contact@sousnosailes.test", description: "Adresse de réception du formulaire de contact public (à remplacer avant mise en ligne)" },
    { key: "legal.policy_version", value: "2026-10", description: "Version courante des politiques (cookies, confidentialité) enregistrée avec les consentements" },
  ];
  for (const s of settings) {
    await ctx.db.insert(configurationSettings).values({ key: s.key, value: s.value, description: s.description }).onConflictDoNothing();
  }
}
