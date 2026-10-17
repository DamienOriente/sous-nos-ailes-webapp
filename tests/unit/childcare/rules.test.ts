import { describe, expect, it } from "vitest";
import { aggregateDietary, computePresence, decideSensitiveRead, filterVisibleChildren, hasActiveConsent, summarizePresence, validateHandover } from "@/modules/childcare/domain/rules";
import { resolveEventPermissions } from "@/modules/authorization/domain/permissions";

describe("who sees which children", () => {
  const children = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("organisers see the whole roster", () => {
    expect(filterVisibleChildren(children, { childScopeIsAssignmentOnly: false }, new Set())).toHaveLength(3);
  });
  it("childcare staff only see assigned children", () => {
    expect(filterVisibleChildren(children, { childScopeIsAssignmentOnly: true }, new Set(["b"])).map((c) => c.id)).toEqual(["b"]);
    expect(filterVisibleChildren(children, { childScopeIsAssignmentOnly: true }, new Set())).toEqual([]);
  });
  it("role defaults: owner has sensitive + logs, planner needs explicit grant, animation trade has no sensitive access", () => {
    const owner = resolveEventPermissions({ role: "owner", categorySlug: null, overrides: [] });
    expect(owner.has("children.view_sensitive")).toBe(true);
    expect(owner.has("children.view_access_logs")).toBe(true);
    const planner = resolveEventPermissions({ role: "wedding_planner", categorySlug: "wedding-planner", overrides: [] });
    expect(planner.has("children.view_roster")).toBe(true);
    expect(planner.has("children.view_sensitive")).toBe(false);
    const granted = resolveEventPermissions({ role: "wedding_planner", categorySlug: "wedding-planner", overrides: [{ permission: "children.view_sensitive", effect: "allow", expiresAt: null }] });
    expect(granted.has("children.view_sensitive")).toBe(true);
    const nanny = resolveEventPermissions({ role: "provider", categorySlug: "garde-enfants-evenementielle", overrides: [] });
    expect(nanny.has("children.view_sensitive")).toBe(true);
    expect(nanny.has("children.handover")).toBe(true);
    expect(nanny.has("children.manage")).toBe(false);
    const animator = resolveEventPermissions({ role: "provider", categorySlug: "animation-enfants", overrides: [] });
    expect(animator.has("children.view_roster")).toBe(true);
    expect(animator.has("children.view_sensitive")).toBe(false);
    const caterer = resolveEventPermissions({ role: "provider", categorySlug: "traiteur", overrides: [] });
    expect(caterer.has("children.view_roster")).toBe(false);
    expect(caterer.has("catering.view_dietary_counts")).toBe(true);
  });
});

describe("sensitive data read decision", () => {
  const consent = { consentGivenAt: new Date("2027-01-01"), consentWithdrawnAt: null };
  it("requires permission, assignment, active consent and a purpose", () => {
    expect(decideSensitiveRead({ hasPermission: true, scopeIsAssignmentOnly: true, isAssigned: true, consent, purpose: "goûter" })).toEqual({ allowed: true });
    expect(decideSensitiveRead({ hasPermission: false, scopeIsAssignmentOnly: false, isAssigned: true, consent, purpose: "x" })).toEqual({ allowed: false, reason: "no_permission" });
    expect(decideSensitiveRead({ hasPermission: true, scopeIsAssignmentOnly: true, isAssigned: false, consent, purpose: "goûter" })).toEqual({ allowed: false, reason: "not_assigned" });
    expect(decideSensitiveRead({ hasPermission: true, scopeIsAssignmentOnly: false, isAssigned: true, consent: null, purpose: "goûter" })).toEqual({ allowed: false, reason: "no_consent" });
    expect(decideSensitiveRead({ hasPermission: true, scopeIsAssignmentOnly: false, isAssigned: true, consent: { ...consent, consentWithdrawnAt: new Date() }, purpose: "goûter" })).toEqual({ allowed: false, reason: "no_consent" });
    expect(decideSensitiveRead({ hasPermission: true, scopeIsAssignmentOnly: false, isAssigned: true, consent, purpose: "  " })).toEqual({ allowed: false, reason: "missing_purpose" });
  });
  it("hasActiveConsent", () => {
    expect(hasActiveConsent(null)).toBe(false);
    expect(hasActiveConsent({ consentGivenAt: null, consentWithdrawnAt: null })).toBe(false);
    expect(hasActiveConsent(consent)).toBe(true);
  });
});

describe("handover validation", () => {
  const ok = { authorizedPersonId: "p1", identityCheckMethod: "id_document", identityCheckDetails: "CNI au nom de Dupont", confirmerHasPermission: true, confirmerIsAssignedOrOrganizer: true };
  it("accepts a complete handover and builds the identity text", () => {
    const r = validateHandover(ok);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.identityVerifiedHow).toBe("Pièce d'identité présentée — CNI au nom de Dupont");
  });
  it("refuses without an authorised person from the list", () => {
    const r = validateHandover({ ...ok, authorizedPersonId: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/personne autorisée/);
  });
  it("refuses without identity verification or with 'other' lacking details", () => {
    expect(validateHandover({ ...ok, identityCheckMethod: "" }).ok).toBe(false);
    expect(validateHandover({ ...ok, identityCheckMethod: "qr_code" }).ok).toBe(false);
    expect(validateHandover({ ...ok, identityCheckMethod: "other", identityCheckDetails: "" }).ok).toBe(false);
    expect(validateHandover({ ...ok, identityCheckMethod: "other", identityCheckDetails: "badge employeur" }).ok).toBe(true);
  });
  it("refuses when the confirmer is not entitled or not assigned", () => {
    expect(validateHandover({ ...ok, confirmerHasPermission: false }).ok).toBe(false);
    expect(validateHandover({ ...ok, confirmerIsAssignedOrOrganizer: false }).ok).toBe(false);
  });
});

describe("presence", () => {
  it("derives status from the latest check-in/out and summarises", () => {
    const t = (m: number) => new Date(2027, 5, 12, 15, m);
    const presence = computePresence(
      ["a", "b", "c"],
      [
        { childId: "a", kind: "check_in", recordedAt: t(0) },
        { childId: "b", kind: "check_in", recordedAt: t(1) },
        { childId: "b", kind: "note", recordedAt: t(2) },
        { childId: "b", kind: "check_out", recordedAt: t(3) },
        { childId: "zzz", kind: "check_in", recordedAt: t(4) }, // unknown child ignored
      ],
    );
    expect(presence.get("a")).toBe("present");
    expect(presence.get("b")).toBe("left");
    expect(presence.get("c")).toBe("expected");
    expect(summarizePresence(presence)).toEqual({ expected: 1, present: 1, left: 1 });
  });
});

describe("anonymous dietary counts", () => {
  it("aggregates by normalised label, adults vs children, standard first", () => {
    const rows = aggregateDietary([
      { preference: "Végétarien", isChild: false },
      { preference: "végétarien ", isChild: true },
      { preference: null, isChild: false },
      { preference: "", isChild: true },
      { preference: "sans gluten", isChild: true },
    ]);
    expect(rows[0]).toEqual({ label: "standard", adults: 1, children: 1, total: 2 });
    expect(rows.find((r) => r.label === "végétarien")).toEqual({ label: "végétarien", adults: 1, children: 1, total: 2 });
    expect(rows.find((r) => r.label === "sans gluten")).toEqual({ label: "sans gluten", adults: 0, children: 1, total: 1 });
    expect(JSON.stringify(rows)).not.toMatch(/name|prénom/i);
  });
});
