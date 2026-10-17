import { describe, expect, it } from "vitest";
import { DRAFT_NOTICE, LEGAL_DEFAULTS, LEGAL_SLUGS, isLegalSlug } from "@/modules/legal/domain/defaults";
import { isSafeHref, parseInline, parseMarkdown, tableOfContents } from "@/modules/legal/domain/markdown";
import { extractVariables, isPlaceholderValue, MISSING_PLACEHOLDER, resolveVariables, toLegalVariables } from "@/modules/legal/domain/variables";

describe("legal variables", () => {
  it("extracts unique, lower-cased variable keys", () => {
    expect(extractVariables("A {{legal.siret}} B {{ Legal.SIRET }} C {{retention.audit_logs_months}}")).toEqual(["legal.siret", "retention.audit_logs_months"]);
  });

  it("replaces known variables and marks missing ones with the placeholder", () => {
    const { text, missing } = resolveVariables("Éditeur : {{legal.company_name}} — DPO : {{legal.dpo_email}}", { "legal.company_name": "ACME" });
    expect(text).toBe(`Éditeur : ACME — DPO : ${MISSING_PLACEHOLDER}`);
    expect(missing).toEqual(["legal.dpo_email"]);
  });

  it("treats empty strings as missing and ignores non-scalar settings", () => {
    const vars = toLegalVariables([
      { key: "legal.a", value: "" },
      { key: "legal.b", value: { nested: true } },
      { key: "retention.days", value: 30 },
    ]);
    expect(vars).toEqual({ "legal.a": "", "retention.days": "30" });
    expect(resolveVariables("{{legal.a}}", vars).missing).toEqual(["legal.a"]);
  });

  it("recognises seed placeholders", () => {
    expect(isPlaceholderValue("[SIRET À COMPLÉTER]")).toBe(true);
    expect(isPlaceholderValue("123 456 789 00012")).toBe(false);
  });
});

describe("restricted markdown", () => {
  it("parses headings, paragraphs, lists and notices without interpreting HTML", () => {
    const blocks = parseMarkdown(`> Note\n\n## Titre A\nParagraphe <script>alert(1)</script> **gras** _it_\n\n- un\n- deux\n\n1. premier\n2. second\n\n### Sous-titre`);
    expect(blocks.map((b) => b.type)).toEqual(["notice", "heading", "paragraph", "list", "list", "heading"]);
    const p = blocks[2];
    expect(p?.type === "paragraph" && p.inlines.some((i) => i.type === "text" && i.value.includes("<script>"))).toBe(true);
    const ul = blocks[3];
    const ol = blocks[4];
    expect(ul?.type === "list" && !ul.ordered && ul.items.length === 2).toBe(true);
    expect(ol?.type === "list" && ol.ordered && ol.items.length === 2).toBe(true);
  });

  it("only keeps safe links (https, mailto, internal paths)", () => {
    expect(isSafeHref("https://cnil.fr")).toBe(true);
    expect(isSafeHref("/cgu")).toBe(true);
    expect(isSafeHref("mailto:a@b.fr")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("//evil.example")).toBe(false);
    const inl = parseInline("voir [ici](javascript:alert(1)) et [là](/cgu)");
    expect(inl.find((i) => i.type === "link")).toEqual({ type: "link", href: "/cgu", label: "là" });
    expect(inl.some((i) => i.type === "text" && i.value === "ici")).toBe(true);
  });

  it("builds a table of contents with unique heading ids", () => {
    const blocks = parseMarkdown("## Objet\n\ntexte\n\n## Objet\n\n## Données des enfants");
    expect(tableOfContents(blocks)).toEqual([
      { id: "objet", label: "Objet" },
      { id: "objet-2", label: "Objet" },
      { id: "donnees-des-enfants", label: "Données des enfants" },
    ]);
  });
});

describe("default legal documents", () => {
  it("exist for every slug, carry the draft notice and never invent publisher data", () => {
    for (const slug of LEGAL_SLUGS) {
      const doc = LEGAL_DEFAULTS[slug];
      expect(doc.slug).toBe(slug);
      expect(doc.body).toContain(DRAFT_NOTICE);
      // Any publisher fact must be a variable, never a literal: no digits that look like a SIRET/phone, no street address.
      expect(doc.body).not.toMatch(/\b\d{3} ?\d{3} ?\d{3} ?\d{5}\b/);
      expect(doc.body).not.toMatch(/\b\d{1,3} (rue|avenue|boulevard)\b/i);
      expect(parseMarkdown(doc.body).length).toBeGreaterThan(3);
    }
    expect(isLegalSlug("cgu")).toBe(true);
    expect(isLegalSlug("admin")).toBe(false);
  });

  it("references the legal variables the seed provides", () => {
    const vars = extractVariables(LEGAL_DEFAULTS["mentions-legales"].body);
    expect(vars).toEqual(expect.arrayContaining(["legal.company_name", "legal.siret", "legal.host", "legal.publication_director"]));
  });
});
