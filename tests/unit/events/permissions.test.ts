import { describe, expect, it } from "vitest";
import { EVENT_PERMISSIONS, EVENT_ROLE_PERMISSIONS, resolveEventPermissions, TRADE_PERMISSIONS } from "@/modules/authorization/domain/permissions";
import { PERMISSION_LABELS } from "@/modules/events/domain/permission-labels";
import { canTransitionProvider } from "@/modules/events/domain/providers";

describe("resolveEventPermissions", () => {
  it("owner has everything needed to run the event, including health data", () => {
    const p = resolveEventPermissions({ role: "owner", categorySlug: null, overrides: [] });
    expect(p.has("event.delete")).toBe(true);
    expect(p.has("event.permissions.manage")).toBe(true);
    expect(p.has("children.view_sensitive")).toBe(true);
  });
  it("co-organiser cannot manage members nor read health data by default", () => {
    const p = resolveEventPermissions({ role: "co_organizer", categorySlug: null, overrides: [] });
    expect(p.has("event.members.manage")).toBe(false);
    expect(p.has("children.view_sensitive")).toBe(false);
    expect(p.has("event.budget.manage")).toBe(true);
  });
  it("wedding planner needs an explicit grant for health data", () => {
    const without = resolveEventPermissions({ role: "wedding_planner", categorySlug: "wedding-planner", overrides: [] });
    expect(without.has("children.view_sensitive")).toBe(false);
    const withGrant = resolveEventPermissions({ role: "wedding_planner", categorySlug: "wedding-planner", overrides: [{ permission: "children.view_sensitive", effect: "allow", expiresAt: null }] });
    expect(withGrant.has("children.view_sensitive")).toBe(true);
  });
  it("trade extras apply to providers and staff only", () => {
    const provider = resolveEventPermissions({ role: "provider", categorySlug: "garde-enfants-evenementielle", overrides: [] });
    expect(provider.has("children.view_roster")).toBe(true);
    expect(provider.has("children.view_sensitive")).toBe(true);
    expect(provider.has("event.budget.view")).toBe(false);
    const collaborator = resolveEventPermissions({ role: "collaborator", categorySlug: "garde-enfants-evenementielle", overrides: [] });
    expect(collaborator.has("children.view_roster")).toBe(false);
    const caterer = resolveEventPermissions({ role: "provider", categorySlug: "traiteur", overrides: [] });
    expect(caterer.has("catering.view_dietary_counts")).toBe(true);
    expect(caterer.has("venue.view_logistics")).toBe(false);
  });
  it("an explicit deny beats the role and trade defaults", () => {
    const p = resolveEventPermissions({ role: "provider", categorySlug: "garde-enfants-evenementielle", overrides: [{ permission: "children.view_sensitive", effect: "deny", expiresAt: null }] });
    expect(p.has("children.view_sensitive")).toBe(false);
    expect(p.has("children.view_roster")).toBe(true);
  });
  it("deny wins over allow for the same permission", () => {
    const p = resolveEventPermissions({ role: "guest", categorySlug: null, overrides: [{ permission: "event.tasks.view", effect: "allow", expiresAt: null }, { permission: "event.tasks.view", effect: "deny", expiresAt: null }] });
    expect(p.has("event.tasks.view")).toBe(false);
  });
  it("expired overrides are ignored, future ones apply", () => {
    const now = new Date("2027-01-01T00:00:00Z");
    const expired = resolveEventPermissions({ role: "guest", categorySlug: null, overrides: [{ permission: "event.tasks.view", effect: "allow", expiresAt: new Date("2026-12-31T00:00:00Z") }], now });
    expect(expired.has("event.tasks.view")).toBe(false);
    const future = resolveEventPermissions({ role: "guest", categorySlug: null, overrides: [{ permission: "event.tasks.view", effect: "allow", expiresAt: new Date("2027-02-01T00:00:00Z") }], now });
    expect(future.has("event.tasks.view")).toBe(true);
  });
  it("ignores unknown permission keys in allow overrides", () => {
    const p = resolveEventPermissions({ role: "guest", categorySlug: null, overrides: [{ permission: "does.not.exist", effect: "allow", expiresAt: null }] });
    expect([...p]).toEqual(["event.view"]);
  });
  it("every role default and trade extra is a known permission", () => {
    const known = new Set<string>(EVENT_PERMISSIONS);
    for (const list of Object.values(EVENT_ROLE_PERMISSIONS)) for (const p of list) expect(known.has(p)).toBe(true);
    for (const list of Object.values(TRADE_PERMISSIONS)) for (const p of list) expect(known.has(p)).toBe(true);
  });
  it("every permission has a French label", () => {
    for (const p of EVENT_PERMISSIONS) expect(PERMISSION_LABELS[p]).toBeTruthy();
  });
});

describe("provider status transitions", () => {
  it("shortlisted → requested → quoted → confirmed", () => {
    expect(canTransitionProvider("shortlisted", "requested")).toBe(true);
    expect(canTransitionProvider("requested", "quoted")).toBe(true);
    expect(canTransitionProvider("quoted", "confirmed")).toBe(true);
    expect(canTransitionProvider("confirmed", "quoted")).toBe(false);
    expect(canTransitionProvider("declined", "confirmed")).toBe(false);
  });
});
