import { describe, expect, it } from "vitest";
import { canTransition, changedMajorFields, describeStatus, PROFESSIONAL_STATUSES } from "@/modules/professionals/domain/status";
import { canTransitionInquiry, INQUIRY_STATUSES, nextInquiryStatuses } from "@/modules/inquiries/domain/inquiry-status";
import { resolveUniqueSlug } from "@/modules/professionals/domain/slug";
import { isValidSiren, isValidSiret, sirenFromSiret } from "@/modules/professionals/domain/siret";
import { buildTradeSchema, summarizeTradeDetails, TRADE_FORM_KEYS, tradeFormDataToObject } from "@/modules/professionals/domain/trade-forms";
import { parseSearchParams, toQueryString } from "@/modules/directory/domain/search-params";

describe("listing status machine", () => {
  it("lets the owner submit a draft and re-submit after changes requested, never self-publish", () => {
    expect(canTransition("draft", "pending_review", "owner")).toBe(true);
    expect(canTransition("changes_requested", "pending_review", "owner")).toBe(true);
    expect(canTransition("rejected", "pending_review", "owner")).toBe(true);
    expect(canTransition("draft", "published", "owner")).toBe(false);
    expect(canTransition("pending_review", "published", "owner")).toBe(false);
    expect(canTransition("published", "pending_review", "owner")).toBe(false);
  });

  it("lets a moderator decide only on submitted/approved/published listings", () => {
    expect(canTransition("pending_review", "published", "moderator")).toBe(true);
    expect(canTransition("pending_review", "changes_requested", "moderator")).toBe(true);
    expect(canTransition("published", "suspended", "moderator")).toBe(true);
    expect(canTransition("suspended", "published", "moderator")).toBe(true);
    expect(canTransition("draft", "published", "moderator")).toBe(false);
    expect(canTransition("archived", "published", "moderator")).toBe(false);
  });

  it("archiving is terminal and always available to the owner except when archived", () => {
    for (const s of PROFESSIONAL_STATUSES) expect(canTransition(s, "archived", "owner")).toBe(s !== "archived");
    for (const s of PROFESSIONAL_STATUSES) expect(canTransition("archived", s, "owner")).toBe(false);
  });

  it("describes every status with an explanation and a next step", () => {
    for (const s of PROFESSIONAL_STATUSES) {
      const d = describeStatus(s, "motif");
      expect(d.explanation.length).toBeGreaterThan(10);
      expect(d.nextStep.length).toBeGreaterThan(10);
    }
    expect(describeStatus("changes_requested", "ajoutez une photo").explanation).toContain("ajoutez une photo");
  });

  it("detects major field changes only", () => {
    const before = { displayName: "A", primaryCategoryId: "c1", description: "d", tagline: "t" };
    expect(changedMajorFields(before, { ...before })).toEqual([]);
    expect(changedMajorFields(before, { ...before, displayName: "B" })).toEqual(["displayName"]);
    expect(changedMajorFields(before, { ...before, description: "e", tagline: "u" })).toEqual(["description", "tagline"]);
  });
});

describe("inquiry status machine", () => {
  it("follows new → viewed → info_requested/quoted → accepted → confirmed → archived", () => {
    expect(canTransitionInquiry("new", "viewed")).toBe(true);
    expect(canTransitionInquiry("viewed", "quoted")).toBe(true);
    expect(canTransitionInquiry("quoted", "accepted")).toBe(true);
    expect(canTransitionInquiry("accepted", "confirmed")).toBe(true);
    expect(canTransitionInquiry("confirmed", "archived")).toBe(true);
    expect(canTransitionInquiry("new", "confirmed")).toBe(false);
    expect(canTransitionInquiry("archived", "viewed")).toBe(false);
    for (const s of INQUIRY_STATUSES) expect(nextInquiryStatuses(s).includes(s)).toBe(false);
  });
});

describe("slug", () => {
  it("slugifies, avoids reserved words and suffixes collisions", () => {
    expect(resolveUniqueSlug("Marie Delcourt — Garde d'enfants", () => false)).toBe("marie-delcourt-garde-d-enfants");
    expect(resolveUniqueSlug("Admin", () => false)).toBe("admin-2");
    const taken = new Set(["les-petits-nuages", "les-petits-nuages-2"]);
    expect(resolveUniqueSlug("Les Petits Nuages", (c) => taken.has(c))).toBe("les-petits-nuages-3");
    expect(resolveUniqueSlug("A", () => false)).toBe("pro-a");
  });
});

describe("SIREN / SIRET", () => {
  it("validates with Luhn", () => {
    expect(isValidSiren("732829320")).toBe(true); // La Poste SIREN (public example)
    expect(isValidSiren("732829321")).toBe(false);
    expect(isValidSiret("732 829 320 00074")).toBe(true);
    expect(isValidSiret("73282932000075")).toBe(false);
    expect(isValidSiret("1234")).toBe(false);
    expect(sirenFromSiret("73282932000074")).toBe("732829320");
  });
});

describe("trade forms", () => {
  it("builds a schema for every key that rejects missing required fields and accepts a valid payload", () => {
    for (const k of TRADE_FORM_KEYS) expect(buildTradeSchema(k).safeParse({}).success).toBe(false);
    const childcare = buildTradeSchema("childcare").safeParse({ experienceYears: "5", ageRanges: ["1-3"], services: ["supervision"], legalStatus: "micro", maxChildrenPerStaff: "6", insuranceDeclared: true });
    expect(childcare.success).toBe(true);
    const bad = buildTradeSchema("childcare").safeParse({ experienceYears: "5", ageRanges: [], services: ["supervision"], legalStatus: "micro", maxChildrenPerStaff: "60" });
    expect(bad.success).toBe(false);
  });

  it("converts FormData (multiselect, checkbox, numbers) and summarises labels", () => {
    const fd = new FormData();
    fd.append("trade.styles", "Généraliste");
    fd.append("trade.styles", "Rock");
    fd.set("trade.ceremonyMusic", "on");
    fd.set("trade.maxGuests", "");
    const obj = tradeFormDataToObject("dj", fd);
    expect(obj.styles).toEqual(["Généraliste", "Rock"]);
    expect(obj.ceremonyMusic).toBe(true);
    expect(obj.maxGuests).toBeNull();
    const parsed = buildTradeSchema("dj").parse(obj);
    const lines = summarizeTradeDetails("dj", parsed);
    expect(lines.find((l) => l.label === "Styles musicaux")?.value).toBe("Généraliste, Rock");
    expect(lines.find((l) => l.label.startsWith("Je propose aussi"))?.value).toBe("Oui");
  });

  it("falls back to the generic form for unknown keys", () => {
    expect(buildTradeSchema("unknown").safeParse({ specialties: "x" }).success).toBe(true);
  });
});

describe("search params", () => {
  it("parses with defaults, recovers from invalid values and round-trips", () => {
    const f = parseSearchParams({ q: "garde", radius: "abc", page: "2", verification: "9", children: "1" });
    expect(f.q).toBe("garde");
    expect(f.radius).toBe(0);
    expect(f.page).toBe(2);
    expect(f.verification).toBe(0);
    expect(f.children).toBe("1");
    expect(toQueryString({ q: "garde", page: 1, radius: 0, children: "1" })).toBe("?q=garde&children=1");
  });
});
