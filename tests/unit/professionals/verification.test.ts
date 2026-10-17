import { describe, expect, it } from "vitest";
import { computeVerificationLevel, VERIFICATION_KIND_LABELS, VERIFICATION_KINDS, verificationLevelLabel, verifiedStatements, type VerificationRow } from "@/modules/professionals/domain/verification";

const row = (kind: VerificationRow["kind"], status: VerificationRow["status"] = "verified", validUntil: Date | null = null): VerificationRow => ({ kind, status, validUntil });

describe("computeVerificationLevel", () => {
  it("is 0 without any verified row", () => {
    expect(computeVerificationLevel([])).toBe(0);
    expect(computeVerificationLevel([row("identity_declared", "pending")])).toBe(0);
  });

  it("climbs step by step and never skips a prerequisite", () => {
    expect(computeVerificationLevel([row("identity_declared")])).toBe(1);
    expect(computeVerificationLevel([row("identity_declared"), row("business_registration_checked")])).toBe(2);
    expect(computeVerificationLevel([row("identity_declared"), row("administrative_check_done")])).toBe(2);
    expect(computeVerificationLevel([row("identity_declared"), row("business_registration_checked"), row("documents_reviewed")])).toBe(3);
    expect(computeVerificationLevel([row("identity_declared"), row("business_registration_checked"), row("documents_reviewed"), row("insurance_verified")])).toBe(4);
    expect(computeVerificationLevel([row("identity_declared"), row("business_registration_checked"), row("documents_reviewed"), row("insurance_verified"), row("qualification_verified")])).toBe(5);
    // insurance verified without documents reviewed → stays at 2
    expect(computeVerificationLevel([row("identity_declared"), row("business_registration_checked"), row("insurance_verified")])).toBe(2);
    // declared-only insurance does not raise the level
    expect(computeVerificationLevel([row("identity_declared"), row("business_registration_checked"), row("documents_reviewed"), row("insurance_declared")])).toBe(3);
  });

  it("ignores expired or rejected rows", () => {
    const past = new Date(Date.now() - 1000);
    const rows = [row("identity_declared"), row("business_registration_checked"), row("documents_reviewed"), row("insurance_verified", "verified", past)];
    expect(computeVerificationLevel(rows)).toBe(3);
    expect(computeVerificationLevel([row("identity_declared"), row("business_registration_checked", "rejected")])).toBe(1);
  });

  it("labels never claim a certification", () => {
    for (let l = 0; l <= 5; l += 1) expect(verificationLevelLabel(l).toLowerCase()).not.toContain("certifi");
    for (const k of VERIFICATION_KINDS) {
      expect(VERIFICATION_KIND_LABELS[k].label.toLowerCase()).not.toContain("certifi");
      expect(VERIFICATION_KIND_LABELS[k].meaning.length).toBeGreaterThan(20);
    }
    expect(verificationLevelLabel(99)).toBe(verificationLevelLabel(5));
  });

  it("lists verified statements in catalogue order", () => {
    const s = verifiedStatements([row("insurance_verified"), row("identity_declared"), row("documents_reviewed", "pending")]);
    expect(s).toEqual(["Identité renseignée", "Assurance vérifiée"]);
  });
});
