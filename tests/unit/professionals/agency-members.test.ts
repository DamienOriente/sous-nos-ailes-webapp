import { describe, expect, it } from "vitest";
import { canEditMember, canManageMembers, evaluateOrganizationInvitation, inviteMemberSchema } from "@/modules/professionals/domain/members";

describe("agency member rules", () => {
  it("only owners and admins manage the team", () => {
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("manager")).toBe(false);
    expect(canManageMembers(null)).toBe(false);
  });

  it("never lets the owner be edited, even with a non-owner role row", () => {
    expect(canEditMember({ role: "owner", isOrganizationOwner: false })).toBe(false);
    expect(canEditMember({ role: "admin", isOrganizationOwner: true })).toBe(false);
    expect(canEditMember({ role: "manager", isOrganizationOwner: false })).toBe(true);
  });

  it("evaluates invitation tokens: revoked, then used, then expired", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    const base = { expiresAt: new Date("2026-10-20T00:00:00Z"), acceptedAt: null, revokedAt: null };
    expect(evaluateOrganizationInvitation(base, now)).toBe("valid");
    expect(evaluateOrganizationInvitation({ ...base, expiresAt: now }, now)).toBe("expired");
    expect(evaluateOrganizationInvitation({ ...base, acceptedAt: now }, now)).toBe("used");
    expect(evaluateOrganizationInvitation({ ...base, acceptedAt: now, revokedAt: now }, now)).toBe("revoked");
  });

  it("normalises the e-mail and refuses the owner role", () => {
    expect(inviteMemberSchema.parse({ email: "  Lea@Example.FR ", role: "manager" })).toEqual({ email: "lea@example.fr", role: "manager" });
    expect(inviteMemberSchema.safeParse({ email: "lea@example.fr", role: "owner" }).success).toBe(false);
    expect(inviteMemberSchema.safeParse({ email: "pas-un-email", role: "admin" }).success).toBe(false);
  });
});
