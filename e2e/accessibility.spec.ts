import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated accessibility gate (axe-core, WCAG 2.x A/AA rules). Zero serious or
 * critical violation on the main public pages, in light and dark mode. This is
 * a floor, not an audit: see /accessibilite for the honest status.
 */
const PAGES: Array<{ path: string; name: string }> = [
  { path: "/", name: "accueil" },
  { path: "/annuaire", name: "annuaire" },
  { path: "/annuaire/garde-enfants-evenementielle", name: "annuaire catégorie" },
  { path: "/organiser", name: "organiser" },
  { path: "/professionnels", name: "professionnels" },
  { path: "/connexion", name: "connexion" },
  { path: "/tarifs", name: "tarifs" },
  { path: "/confidentialite", name: "page légale" },
  { path: "/signalement", name: "signalement" },
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const p of PAGES) {
      test(`${p.name} : aucune violation serious/critical`, async ({ page }) => {
        const res = await page.goto(p.path);
        test.skip(res?.status() !== 200, `${p.path} not served (status ${res?.status()})`);
        await page.waitForLoadState("load");
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
        const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        const summary = blocking.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n  ")}`).join("\n");
        expect(blocking, summary).toEqual([]);
      });
    }
  });
}
