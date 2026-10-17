import { describe, expect, it } from "vitest";
import { authErrorMessage, backupCodeSchema, passwordStrength, safeNextPath, signInSchema, signUpSchema, totpCodeSchema } from "@/modules/identity/domain/auth";

describe("safeNextPath (open redirect guard)", () => {
  it("accepts relative in-app paths", () => {
    expect(safeNextPath("/app/evenements/123?tab=budget")).toBe("/app/evenements/123?tab=budget");
    expect(safeNextPath("/onboarding")).toBe("/onboarding");
  });
  it("falls back for anything that could leave the origin", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com/app", "", null, undefined, "/app\nSet-Cookie: x", "/app with space"]) {
      expect(safeNextPath(bad)).toBe("/app");
    }
  });
  it("never bounces back to auth pages (loop) and honours a custom fallback", () => {
    expect(safeNextPath("/connexion?next=/app")).toBe("/app");
    expect(safeNextPath("/inscription", "/onboarding")).toBe("/onboarding");
    expect(safeNextPath(null, "/onboarding")).toBe("/onboarding");
  });
  it("rejects absurdly long values", () => {
    expect(safeNextPath(`/${"a".repeat(3000)}`)).toBe("/app");
  });
});

describe("passwordStrength", () => {
  it("is empty for an empty password", () => {
    expect(passwordStrength("").score).toBe(0);
  });
  it("caps short or trivial passwords at 'faible'", () => {
    expect(passwordStrength("abc").score).toBeLessThanOrEqual(1);
    expect(passwordStrength("1234567890").score).toBeLessThanOrEqual(1);
    expect(passwordStrength("motdepasse").score).toBe(0);
  });
  it("rewards length and character variety", () => {
    expect(passwordStrength("Demo-SousNosAiles-2026!").score).toBe(4);
    expect(passwordStrength("correct horse battery").score).toBeGreaterThanOrEqual(2);
  });
  it("gives an actionable hint while typing", () => {
    expect(passwordStrength("abc").hints[0]).toMatch(/Encore 7/);
  });
});

describe("schemas", () => {
  it("sign-up requires explicit terms acceptance and a 10+ char password", () => {
    const base = { firstName: "Ana", lastName: "Dupont", email: "ANA@Example.com ", password: "longenough-pw" };
    expect(signUpSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, acceptTerms: true, password: "short" }).success).toBe(false);
    const ok = signUpSchema.safeParse({ ...base, acceptTerms: true });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe("ana@example.com");
  });
  it("sign-in defaults rememberMe to true", () => {
    const r = signInSchema.safeParse({ email: "a@b.fr", password: "x" });
    expect(r.success && r.data.rememberMe).toBe(true);
  });
  it("totp and backup codes are normalised", () => {
    expect(totpCodeSchema.safeParse(" 123456 ").success).toBe(true);
    expect(totpCodeSchema.safeParse("12345").success).toBe(false);
    const bc = backupCodeSchema.safeParse(" aBcDe 12345 ");
    expect(bc.success && bc.data).toBe("aBcDe-12345");
    expect(backupCodeSchema.safeParse("aBcDe-12345").success && backupCodeSchema.parse("aBcDe-12345")).toBe("aBcDe-12345");
    expect(backupCodeSchema.safeParse("abc").success).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("is generic for credential errors (no account enumeration)", () => {
    const generic = authErrorMessage("INVALID_EMAIL_OR_PASSWORD");
    expect(authErrorMessage("USER_NOT_FOUND")).toBe(generic);
    expect(authErrorMessage("CREDENTIAL_ACCOUNT_NOT_FOUND")).toBe(generic);
    expect(generic).not.toMatch(/existe|inconnu/i);
  });
  it("prioritises the 429 wording", () => {
    expect(authErrorMessage("INVALID_EMAIL_OR_PASSWORD", 429)).toMatch(/Trop de tentatives/);
  });
});
