import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  checkConfirmation,
  clientStageFor,
  computeTeamStatus,
  EVENT_TRANSITIONS,
} from "@/domain/workflow";

describe("event workflow", () => {
  it("follows the nominal path", () => {
    expect(canTransition("NEW", "QUALIFYING")).toBe(true);
    expect(canTransition("QUALIFYING", "PROPOSAL_SENT")).toBe(true);
    expect(canTransition("PROPOSAL_SENT", "AGREED")).toBe(true);
    expect(canTransition("AGREED", "PREPARING")).toBe(true);
    expect(canTransition("PREPARING", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "COMPLETED")).toBe(true);
  });

  it("refuses shortcuts and terminal exits", () => {
    expect(canTransition("NEW", "CONFIRMED")).toBe(false);
    expect(canTransition("COMPLETED", "NEW")).toBe(false);
    expect(canTransition("CANCELLED", "PREPARING")).toBe(false);
    expect(() => assertTransition("NEW", "COMPLETED")).toThrow(/non autorisée/);
  });

  it("allows declined and cancelled from active statuses", () => {
    for (const status of ["NEW", "QUALIFYING", "PROPOSAL_SENT"] as const) {
      expect(EVENT_TRANSITIONS[status]).toContain("DECLINED");
      expect(EVENT_TRANSITIONS[status]).toContain("CANCELLED");
    }
  });

  it("separates team status from commercial status", () => {
    expect(computeTeamStatus({ requiredProviders: 2, assignedCount: 0, pendingInvitations: 0, acceptedInvitationsNotAssigned: 0 })).toBe("NOT_STARTED");
    expect(computeTeamStatus({ requiredProviders: 2, assignedCount: 0, pendingInvitations: 1, acceptedInvitationsNotAssigned: 0 })).toBe("INVITING");
    expect(computeTeamStatus({ requiredProviders: 2, assignedCount: 1, pendingInvitations: 0, acceptedInvitationsNotAssigned: 0 })).toBe("PARTIAL");
    expect(computeTeamStatus({ requiredProviders: 2, assignedCount: 2, pendingInvitations: 0, acceptedInvitationsNotAssigned: 0 })).toBe("COMPLETE");
  });

  it("blocks confirmation while anything is missing and explains why", () => {
    const check = checkConfirmation({
      status: "PREPARING",
      hasAcceptedCurrentQuote: false,
      teamStatus: "PARTIAL",
      hasBlockingConflict: true,
      opsValidated: false,
      hasFixedDate: true,
    });
    expect(check.ok).toBe(false);
    expect(check.blockers).toHaveLength(4);
    const ok = checkConfirmation({
      status: "PREPARING",
      hasAcceptedCurrentQuote: true,
      teamStatus: "COMPLETE",
      hasBlockingConflict: false,
      opsValidated: true,
      hasFixedDate: true,
    });
    expect(ok.ok).toBe(true);
  });

  it("maps statuses to client stages", () => {
    expect(clientStageFor("NEW")).toBe("RECEIVED");
    expect(clientStageFor("PROPOSAL_SENT")).toBe("PROPOSAL");
    expect(clientStageFor("PREPARING")).toBe("TEAM");
    expect(clientStageFor("CONFIRMED")).toBe("CONFIRMED");
  });
});
