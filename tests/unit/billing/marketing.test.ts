import { describe, expect, it } from "vitest";
import { isMarketingEligible, MARKETING_EMAILS_ENABLED, sendMarketingEmail } from "@/modules/billing/application/marketing-emails";

describe("marketing e-mails policy (V1)", () => {
  it("is disabled: nobody is eligible, sending throws", async () => {
    expect(MARKETING_EMAILS_ENABLED).toBe(false);
    expect(isMarketingEligible({ marketingOptIn: true, lastEventStatus: "planning", lastEventEndsAt: null })).toBe(false);
    await expect(sendMarketingEmail()).rejects.toThrow(/disabled/);
  });
});
