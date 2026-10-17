import { describe, expect, it } from "vitest";
import { generateDefaultContent, mergeContentForTemplate } from "@/modules/pages/domain/default-content";
import { migrateContent, pageContentSchema, parseContent, parseTheme, plainToRichText, richTextToPlain, safeUrl, SCHEMA_VERSION } from "@/modules/pages/domain/page-schema";

const pro = { displayName: "Marie Delcourt", tagline: "Un espace enfants serein", description: "Depuis huit ans…", categoryName: "Garde d'enfants évènementielle", city: "Toulouse", department: "31", interventionRadiusKm: 60, priceFromCents: 42000, publicEmail: "m@x.test", publicPhone: "0561000000", website: null, socialLinks: { instagram: "https://instagram.com/marie" }, yearsExperience: 8, eventTypes: ["mariage"] };

describe("page content schema", () => {
  it("accepts the generated default content of every template", () => {
    for (const key of ["nid-douillet", "editorial-luxe", "nuit-electrique", "carnet-voyage"]) {
      const content = generateDefaultContent(pro, key);
      const r = parseContent(content);
      expect(r.ok, `${key}: ${r.ok ? "" : r.issues.join(", ")}`).toBe(true);
      expect(content.filter((b) => b.type === "hero")).toHaveLength(1);
    }
  });

  it("rejects HTML tags and script in any text field", () => {
    const base = generateDefaultContent(pro, "minimal-ivoire");
    const hero = base.find((b) => b.type === "hero")!;
    const bad = base.map((b) => (b.id === hero.id ? { ...b, props: { ...b.props, title: "Marie <script>alert(1)</script>" } } : b));
    const r = parseContent(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join(" ")).toMatch(/HTML/);
    const bad2 = base.map((b) => (b.type === "faq" ? { ...b, props: { ...b.props, items: [{ question: "<img src=x onerror=alert(1)>", answer: "ok" }] } } : b));
    expect(parseContent(bad2).ok).toBe(false);
  });

  it("rejects control characters", () => {
    const base = generateDefaultContent(pro, "minimal-ivoire");
    const bad = base.map((b) => (b.type === "about" ? { ...b, props: { ...b.props, heading: "À propos\u0007" } } : b));
    expect(parseContent(bad).ok).toBe(false);
  });

  it("only allows http(s), mailto and tel links", () => {
    expect(safeUrl.safeParse("https://instagram.com/x").success).toBe(true);
    expect(safeUrl.safeParse("http://example.test/a?b=1").success).toBe(true);
    expect(safeUrl.safeParse("mailto:contact@example.test").success).toBe(true);
    expect(safeUrl.safeParse("tel:+33561000000").success).toBe(true);
    expect(safeUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(safeUrl.safeParse("JavaScript:alert(1)").success).toBe(false);
    expect(safeUrl.safeParse("data:text/html,<b>x</b>").success).toBe(false);
    expect(safeUrl.safeParse("ftp://files.test").success).toBe(false);
    expect(safeUrl.safeParse("//evil.test").success).toBe(false);
  });

  it("rejects duplicate block ids and more than one hero", () => {
    const base = generateDefaultContent(pro, "minimal-ivoire");
    const dup = [...base, { ...base[0]! }];
    expect(pageContentSchema.safeParse(dup).success).toBe(false);
    const hero = base.find((b) => b.type === "hero")!;
    const twoHeroes = [...base, { ...hero, id: "blk-hero2" }];
    expect(pageContentSchema.safeParse(twoHeroes).success).toBe(false);
  });

  it("rejects free-text testimonials (only review ids)", () => {
    const base = generateDefaultContent(pro, "nid-douillet");
    const bad = base.map((b) => (b.type === "testimonials" ? { ...b, props: { heading: "Avis", items: [{ author: "X", text: "Génial" }] } } : b));
    const r = pageContentSchema.safeParse(bad);
    // Unknown keys are stripped; reviewIds must be uuids.
    const bad2 = base.map((b) => (b.type === "testimonials" ? { ...b, props: { ...b.props, reviewIds: ["not-a-uuid"] } } : b));
    expect(r.success ? (r.data.find((b) => b.type === "testimonials") as { props: { reviewIds: string[] } }).props.reviewIds : []).toEqual([]);
    expect(pageContentSchema.safeParse(bad2).success).toBe(false);
  });

  it("enforces size limits", () => {
    const base = generateDefaultContent(pro, "minimal-ivoire");
    const tooLong = base.map((b) => (b.type === "hero" ? { ...b, props: { ...b.props, title: "x".repeat(91) } } : b));
    expect(parseContent(tooLong).ok).toBe(false);
    const tooMany = [...base, ...Array.from({ length: 30 }).map((_, i) => ({ id: `extra${i}`, type: "faq" as const, hidden: false, props: { items: [] } }))];
    expect(parseContent(tooMany).ok).toBe(false);
  });

  it("validates the theme", () => {
    expect(parseTheme({ palette: "laine", accent: "#b7694a", radius: "round" }).ok).toBe(true);
    expect(parseTheme({ accent: "red" }).ok).toBe(false);
    expect(parseTheme({ accent: "#fff" }).ok).toBe(false);
    expect(parseTheme({ radius: "huge" }).ok).toBe(false);
    expect(parseTheme(undefined).ok).toBe(true);
  });

  it("round-trips plain text to rich text", () => {
    const rt = plainToRichText("Premier paragraphe.\n\nDeuxième.");
    expect(rt).toHaveLength(2);
    expect(richTextToPlain(rt)).toBe("Premier paragraphe.\nDeuxième.");
  });
});

describe("migrateContent", () => {
  it("is a no-op for the current version", () => {
    const content = generateDefaultContent(pro, "minimal-ivoire");
    expect(migrateContent(content, SCHEMA_VERSION)).toEqual({ content, schemaVersion: SCHEMA_VERSION });
  });
  it("normalises legacy (version 0) payloads to an empty page", () => {
    expect(migrateContent({ anything: true }, 0)).toEqual({ content: [], schemaVersion: SCHEMA_VERSION });
  });
  it("refuses unknown future versions", () => {
    expect(() => migrateContent([], SCHEMA_VERSION + 1)).toThrow(/Unknown page schema version/);
  });
});

describe("template switch", () => {
  it("keeps existing blocks and appends the new template's missing sections hidden", () => {
    const current = generateDefaultContent(pro, "minimal-ivoire").filter((b) => b.type !== "faq");
    const merged = mergeContentForTemplate(current, "nid-douillet", pro);
    expect(merged.slice(0, current.length)).toEqual(current);
    const appended = merged.slice(current.length);
    expect(appended.length).toBeGreaterThan(0);
    expect(appended.every((b) => b.hidden)).toBe(true);
    expect(appended.some((b) => b.type === "faq")).toBe(true);
    expect(parseContent(merged).ok).toBe(true);
  });
});
