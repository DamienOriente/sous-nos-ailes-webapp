import { describe, expect, it } from "vitest";
import type { PageRenderData } from "@/modules/pages/domain/render-data";
import { sampleRenderData } from "@/modules/pages/domain/sample-content";
import { buildJsonLd, checkDescription, checkTitle, DESCRIPTION_MAX, DESCRIPTION_MIN, generateDescription, generateTitle, googlePreview, serializeJsonLd, suggestTitles, TITLE_MAX } from "@/modules/seo/domain/meta";

const pro = { displayName: "Marie Delcourt", categoryName: "Garde d'enfants évènementielle", city: "Toulouse", department: "31", tagline: "Un espace enfants serein pendant que vous célébrez", description: "Depuis huit ans, nous installons un espace enfants complet lors des mariages.", eventTypes: ["mariage", "baptême"], yearsExperience: 8 };

describe("title and description generation", () => {
  it("builds a title with trade and city within the limit", () => {
    const t = generateTitle(pro);
    expect(t).toBe("Marie Delcourt – Garde d'enfants évènementielle à Toulouse");
    expect(t.length).toBeLessThanOrEqual(TITLE_MAX);
  });
  it("drops parts until the title fits", () => {
    const t = generateTitle({ ...pro, displayName: "Les Petites Ailes de la Garonne et du Tarn Réunies" });
    expect(t.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(t).toContain("Les Petites Ailes");
  });
  it("suggests several distinct titles, all within the limit", () => {
    const s = suggestTitles(pro);
    expect(s.length).toBeGreaterThanOrEqual(3);
    expect(new Set(s).size).toBe(s.length);
    for (const x of s) expect(x.length).toBeLessThanOrEqual(TITLE_MAX);
  });
  it("produces a description between the bounds, from the tagline/about/listing", () => {
    const d = generateDescription(pro);
    expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    const short = generateDescription({ ...pro, tagline: "Court", description: null });
    expect(short.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
    expect(short).toContain("Toulouse");
    const long = generateDescription({ ...pro, tagline: null, description: "mot ".repeat(200) });
    expect(long.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(long.endsWith("…")).toBe(true);
  });
  it("checks lengths with explicit messages", () => {
    expect(checkTitle(null).level).toBe("error");
    expect(checkTitle("Court").level).toBe("warn");
    expect(checkTitle("x".repeat(80)).level).toBe("warn");
    expect(checkTitle("Marie Delcourt – Garde d'enfants à Toulouse").ok).toBe(true);
    expect(checkDescription("x".repeat(100)).ok).toBe(true);
    expect(checkDescription("x".repeat(10)).level).toBe("warn");
  });
  it("truncates the search preview", () => {
    const p = googlePreview({ title: "t".repeat(90), description: "d".repeat(300), url: "https://x.test/pro/a" });
    expect(p.title.length).toBeLessThanOrEqual(60);
    expect(p.description.length).toBeLessThanOrEqual(158);
  });
});

describe("JSON-LD", () => {
  const data: PageRenderData = sampleRenderData("nid-douillet");
  const input = { url: "https://sousnosailes.test/pro/exemple", siteUrl: "https://sousnosailes.test", title: "T", description: "D" };

  it("emits a business, one Service per catalogue service, a breadcrumb and a FAQ", () => {
    const ld = buildJsonLd(data, input);
    const types = ld.map((x) => x["@type"]);
    expect(types[0]).toBe("LocalBusiness");
    expect(types.filter((t) => t === "Service")).toHaveLength(data.services.length);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
    const business = ld[0]!;
    expect(business.name).toBe(data.professional.displayName);
    expect((business.address as { addressLocality: string }).addressLocality).toBe("Toulouse");
  });

  it("maps venues and caterers to specific schema.org types", () => {
    expect(buildJsonLd({ ...data, professional: { ...data.professional, categorySlug: "domaine-reception" } }, input)[0]!["@type"]).toBe("EventVenue");
    expect(buildJsonLd({ ...data, professional: { ...data.professional, categorySlug: "traiteur" } }, input)[0]!["@type"]).toBe("FoodEstablishment");
  });

  it("adds AggregateRating only when published reviews exist", () => {
    const withReviews = buildJsonLd(data, input)[0]!;
    expect((withReviews.aggregateRating as { reviewCount: number }).reviewCount).toBe(data.reviews.length);
    const without = buildJsonLd({ ...data, reviews: [] }, input)[0]!;
    expect(without.aggregateRating).toBeUndefined();
    const noRating = buildJsonLd({ ...data, professional: { ...data.professional, averageRating: null } }, input)[0]!;
    expect(noRating.aggregateRating).toBeUndefined();
  });

  it("serialises without a closing-tag vector", () => {
    const out = serializeJsonLd([{ "@type": "Thing", name: "</script><script>alert(1)</script>" }]);
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script>");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});
