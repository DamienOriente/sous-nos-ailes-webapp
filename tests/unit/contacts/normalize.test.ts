import { describe, expect, it } from "vitest";
import { computeDedupeKey, normalizeEmail, normalizePhoneFr, titleCaseName } from "@/modules/contacts/domain/normalize";

describe("normalizeEmail", () => {
  it("lower-cases and trims", () => {
    expect(normalizeEmail("  Maxime.Girard@Example.test ")).toBe("maxime.girard@example.test");
  });
  it("rejects garbage", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("normalizePhoneFr", () => {
  it("converts French formats to E.164", () => {
    expect(normalizePhoneFr("06 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhoneFr("06.12.34.56.78")).toBe("+33612345678");
    expect(normalizePhoneFr("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhoneFr("+33 (0)6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhoneFr("0033612345678")).toBe("+33612345678");
  });
  it("keeps plausible international numbers and rejects the rest", () => {
    expect(normalizePhoneFr("+41 79 123 45 67")).toBe("+41791234567");
    expect(normalizePhoneFr("12345")).toBeNull();
    expect(normalizePhoneFr("06 12 34")).toBeNull();
    expect(normalizePhoneFr("")).toBeNull();
  });
});

describe("computeDedupeKey", () => {
  it("prefers the e-mail, falls back to the phone", () => {
    expect(computeDedupeKey({ email: "A@B.fr", phone: "0612345678" })).toBe("email:a@b.fr");
    expect(computeDedupeKey({ email: "broken", phone: "0612345678" })).toBe("phone:+33612345678");
    expect(computeDedupeKey({ email: null, phone: null })).toBeNull();
  });
  it("gives the same key to differently formatted duplicates", () => {
    expect(computeDedupeKey({ email: "Maxime.Girard@Example.test " })).toBe(computeDedupeKey({ email: "maxime.girard@example.test" }));
    expect(computeDedupeKey({ phone: "06 12 34 56 78" })).toBe(computeDedupeKey({ phone: "+33612345678" }));
  });
});

describe("titleCaseName", () => {
  it("capitalises all-lowercase names only", () => {
    expect(titleCaseName("jean-pierre dupont")).toBe("Jean-Pierre Dupont");
    expect(titleCaseName("McDonald")).toBe("McDonald");
    expect(titleCaseName("  ")).toBe("");
  });
});
