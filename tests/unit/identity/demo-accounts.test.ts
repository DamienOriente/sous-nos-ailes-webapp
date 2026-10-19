import { describe, expect, it } from "vitest";
import { DEMO_USERS } from "@/db/seed/context";
import { DEMO_ACCOUNTS, findDemoAccount } from "@/modules/identity/domain/demo-accounts";

describe("demo accounts", () => {
  it("covers every seeded demo user with a role line and an internal landing page", () => {
    expect(DEMO_ACCOUNTS.map((a) => a.key)).toEqual(DEMO_USERS.map((u) => u.key));
    for (const a of DEMO_ACCOUNTS) {
      expect(a.role.length).toBeGreaterThan(0);
      expect(a.landing).toMatch(/^\/(app|admin)(\/|$)/);
      expect(a.email).toMatch(/@sousnosailes\.test$/);
    }
  });

  it("sends staff to the back office and organisers to their space", () => {
    expect(findDemoAccount("moderator")?.landing).toBe("/admin");
    expect(findDemoAccount("louis")?.landing).toBe("/app");
    expect(findDemoAccount("marie")?.group).toBe("professional");
  });

  it("knows nothing outside the seeded list", () => {
    expect(findDemoAccount("root")).toBeNull();
    expect(findDemoAccount("")).toBeNull();
  });
});
