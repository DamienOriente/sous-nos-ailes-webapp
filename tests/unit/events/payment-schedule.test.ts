import { describe, expect, it } from "vitest";
import { buildPaymentSchedule, paymentState, reminderDue } from "@/modules/events/domain/payment-schedule";

describe("payment schedule from an accepted quote", () => {
  it("splits deposit at signature and balance before the event", () => {
    expect(buildPaymentSchedule({ totalCents: 1_380_000, depositCents: 414_000, balanceDueDays: 15, eventDate: "2027-06-12", acceptedOn: "2026-10-19" })).toEqual([
      { kind: "deposit", label: "Acompte à la signature", amountCents: 414_000, dueDate: "2026-10-19" },
      { kind: "balance", label: "Solde, 15 jours avant", amountCents: 966_000, dueDate: "2027-05-28" },
    ]);
  });
  it("handles no deposit, a balance on the day and a balance date already passed", () => {
    expect(buildPaymentSchedule({ totalCents: 100, depositCents: 0, balanceDueDays: 0, eventDate: "2027-01-10", acceptedOn: "2026-10-19" })).toEqual([{ kind: "balance", label: "Solde le jour de l'évènement", amountCents: 100, dueDate: "2027-01-10" }]);
    expect(buildPaymentSchedule({ totalCents: 100, depositCents: 40, balanceDueDays: 60, eventDate: "2026-11-01", acceptedOn: "2026-10-19" })[1]?.dueDate).toBe("2026-10-19");
    expect(buildPaymentSchedule({ totalCents: 100, depositCents: 100, balanceDueDays: 10, eventDate: null, acceptedOn: "2026-10-19" })).toHaveLength(1);
  });
  it("states and reminder moments", () => {
    const today = "2026-10-19";
    expect(paymentState({ dueDate: "2026-10-18", paidAt: null }, today)).toBe("overdue");
    expect(paymentState({ dueDate: "2026-10-25", paidAt: null }, today)).toBe("due_soon");
    expect(paymentState({ dueDate: "2026-12-01", paidAt: null }, today)).toBe("upcoming");
    expect(paymentState({ dueDate: "2026-10-18", paidAt: "2026-10-17" }, today)).toBe("paid");
    expect(reminderDue({ dueDate: "2026-10-26", paidAt: null }, today)).toBe("week_before");
    expect(reminderDue({ dueDate: today, paidAt: null }, today)).toBe("due_today");
    expect(reminderDue({ dueDate: "2026-10-18", paidAt: null }, today)).toBe("overdue");
    expect(reminderDue({ dueDate: "2026-10-20", paidAt: null }, today)).toBeNull();
  });
});
