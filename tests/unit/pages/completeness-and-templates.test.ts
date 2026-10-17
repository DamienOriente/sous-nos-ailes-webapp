import { describe, expect, it } from "vitest";
import { computeCompleteness } from "@/modules/pages/domain/completeness";
import { generateDefaultContent } from "@/modules/pages/domain/default-content";
import { plainToRichText, type PageContent } from "@/modules/pages/domain/page-schema";
import { sampleRenderData } from "@/modules/pages/domain/sample-content";
import { contrastRatio, paletteContrastIssues, resolveTheme } from "@/modules/pages/domain/theme";
import { FREE_TEMPLATE_KEYS, orderTemplatesForCategory, TEMPLATE_UNIVERSES, TEMPLATES } from "@/modules/pages/templates/registry";
import { CATEGORY_SEED } from "@/modules/professionals/domain/categories";

const pro = { city: "Toulouse", publicEmail: "m@x.test", publicPhone: null, verificationLevel: 2, reviewCount: 1 };
const snapshot = { displayName: "Marie", tagline: null, description: null, categoryName: "Garde", city: "Toulouse", department: "31", interventionRadiusKm: 50, priceFromCents: null, publicEmail: "m@x.test", publicPhone: null, website: null, socialLinks: {}, yearsExperience: null, eventTypes: [] };

describe("computeCompleteness", () => {
  it("scores an empty page low with every recommendation listed", () => {
    const r = computeCompleteness({ professional: { ...pro, city: null, publicEmail: null, verificationLevel: 0 }, content: [], seoTitle: null, seoDescription: null, catalogServiceCount: 0, publishedReviewCount: 0 });
    expect(r.score).toBe(0);
    expect(r.recommendations.length).toBeGreaterThanOrEqual(14);
    expect(r.recommendations.every((x) => !x.satisfied)).toBe(true);
    expect(r.recommendations.map((x) => x.kind)).toContain("hero_image");
    expect(r.recommendations.find((x) => x.kind === "city")?.target).toBe("listing");
  });

  it("increases as content is filled and explains what is missing", () => {
    const base: PageContent = generateDefaultContent(snapshot, "sauge-elegante");
    const partial = computeCompleteness({ professional: pro, content: base, seoTitle: null, seoDescription: null, catalogServiceCount: 0, publishedReviewCount: 0 });
    const full: PageContent = base.map((b) => {
      if (b.type === "hero") return { ...b, props: { ...b.props, imageFileId: "11111111-1111-4111-8111-111111111111", imageAlt: "Marie" } };
      if (b.type === "about") return { ...b, props: { ...b.props, body: plainToRichText("x".repeat(250)) } };
      if (b.type === "gallery") return { ...b, props: { ...b.props, images: [1, 2, 3].map((i) => ({ fileId: `22222222-2222-4222-8222-22222222222${i}`, alt: `Photo ${i}` })) } };
      if (b.type === "pricing") return { ...b, props: { ...b.props, items: [{ label: "Soirée", priceCents: 42000 }] } };
      return b;
    });
    const done = computeCompleteness({ professional: pro, content: full, seoTitle: "Marie Delcourt – Garde d'enfants à Toulouse", seoDescription: "x".repeat(120), catalogServiceCount: 3, publishedReviewCount: 2 });
    expect(partial.score).toBeGreaterThan(0);
    expect(done.score).toBeGreaterThan(partial.score);
    expect(done.score).toBe(100);
    expect(partial.recommendations.filter((x) => !x.satisfied).map((x) => x.kind)).toEqual(expect.arrayContaining(["hero_image", "about_length", "gallery", "seo_title"]));
    const alt = computeCompleteness({ professional: pro, content: full.map((b) => (b.type === "gallery" ? { ...b, props: { ...b.props, images: b.props.images.map((i) => ({ ...i, alt: "" })) } } : b)), seoTitle: null, seoDescription: null, catalogServiceCount: 1, publishedReviewCount: 0 });
    expect(alt.recommendations.find((x) => x.kind === "gallery_alt")?.message).toMatch(/3 image/);
  });

  it("ignores hidden blocks", () => {
    const base = generateDefaultContent(snapshot, "nid-douillet").map((b) => (b.type === "contact" ? { ...b, hidden: true } : b));
    const r = computeCompleteness({ professional: pro, content: base, seoTitle: null, seoDescription: null, catalogServiceCount: 1, publishedReviewCount: 0 });
    expect(r.recommendations.find((x) => x.kind === "contact")?.satisfied).toBe(false);
  });
});

describe("template registry", () => {
  it("has 24 distinct templates across the required universes, 6 free", () => {
    expect(TEMPLATES).toHaveLength(24);
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(24);
    expect(FREE_TEMPLATE_KEYS).toHaveLength(6);
    for (const u of ["élégant", "minimaliste", "champêtre", "bohème", "luxe", "floral", "moderne", "festif", "artistique", "enfantin raffiné", "corporate", "nature", "photographique", "gastronomique", "musical", "spectacle"]) {
      expect(TEMPLATE_UNIVERSES).toContain(u);
    }
  });

  it("covers every template key referenced by the category catalogue", () => {
    const keys = new Set(TEMPLATES.map((t) => t.key));
    for (const c of CATEGORY_SEED) for (const k of c.suggestedTemplates) expect(keys.has(k), `${c.slug} → ${k}`).toBe(true);
    const ordered = orderTemplatesForCategory(["panorama-photo", "galerie-noire"]);
    expect(ordered[0]?.key).toBe("panorama-photo");
    expect(ordered).toHaveLength(24);
  });

  it("every palette passes AA contrast in light and dark mode, with 2 to 4 palettes per template", () => {
    for (const t of TEMPLATES) {
      expect(t.palettes.length, t.key).toBeGreaterThanOrEqual(2);
      expect(t.palettes.length, t.key).toBeLessThanOrEqual(4);
      for (const p of t.palettes) expect(paletteContrastIssues(p, null), `${t.key}/${p.key}`).toEqual([]);
      expect(t.defaultSections[0]).toBe("hero");
      expect(t.defaultSections).toContain("contact");
    }
  });

  it("resolves a theme with light-dark() variables and keeps a readable accent override", () => {
    const r = resolveTheme("sauge-elegante", { palette: "ardoise", accent: "#ffee00", radius: "sharp" });
    expect(r.palette.key).toBe("ardoise");
    expect(r.cssVars["--pg-bg"]).toMatch(/^light-dark\(#/);
    expect(r.cssVars["--pg-accent"]).toBe("light-dark(#ffee00, #ffee00)");
    expect(r.cssVars["--pg-accent-contrast"]).toBe("light-dark(#161616, #161616)");
    expect(contrastRatio("#ffee00", "#161616")).toBeGreaterThan(4.5);
    expect(r.cssVars["--pg-radius-lg"]).toBe("2px");
    const fallback = resolveTheme("unknown-template", { palette: "nope" });
    expect(fallback.template.key).toBe("minimal-ivoire");
    expect(fallback.palette.key).toBe(fallback.template.palettes[0]?.key);
  });

  it("provides valid sample content for every template", () => {
    for (const t of TEMPLATES) {
      const d = sampleRenderData(t.key);
      expect(d.templateKey).toBe(t.key);
      expect(d.content.length).toBeGreaterThan(3);
      expect(d.reviews.every((r) => r.id.startsWith("sample-"))).toBe(true);
    }
  });
});
