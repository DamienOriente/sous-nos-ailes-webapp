import { describe, expect, it } from "vitest";
import { caseStatusAfter, closesCase, targetProfessionalStatus, validateReason } from "@/modules/moderation/domain/decisions";

describe("moderation decision rules", () => {
  it("maps decisions to listing statuses", () => {
    expect(targetProfessionalStatus("approve", "pending_review")).toBe("published");
    expect(targetProfessionalStatus("request_changes", "published")).toBe("changes_requested");
    expect(targetProfessionalStatus("reinstate", "suspended")).toBe("published");
    expect(targetProfessionalStatus("reinstate", "published")).toBeNull();
    expect(targetProfessionalStatus("note", "published")).toBeNull();
  });
  it("closes the case on terminal decisions only", () => {
    expect(closesCase("approve")).toBe(true);
    expect(closesCase("note")).toBe(false);
    expect(caseStatusAfter("dismiss")).toBe("dismissed");
    expect(caseStatusAfter("escalate")).toBe("in_review");
  });
  it("requires a meaningful reason", () => {
    expect(validateReason("approve", "ok")).toMatch(/au moins/);
    expect(validateReason("approve", "Approuvé.  ")).toMatch(/au moins|Précisez/);
    expect(validateReason("reject", "Description trompeuse sur les diplômes.")).toBeNull();
  });
});
