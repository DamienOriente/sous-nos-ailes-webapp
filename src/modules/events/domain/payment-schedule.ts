import { addDays } from "./checklist";

/**
 * Payment schedule owed to providers (2026-10-19), built from an accepted quote: the deposit is
 * due at signature, the balance N days before the event. Pure. The platform never collects
 * these payments; it reminds the organiser.
 */
export type ScheduleInput = { totalCents: number; depositCents: number; balanceDueDays: number | null; eventDate: string | null; acceptedOn: string };
export type ScheduledPayment = { kind: "deposit" | "balance"; label: string; amountCents: number; dueDate: string };

export function buildPaymentSchedule(q: ScheduleInput): ScheduledPayment[] {
  const out: ScheduledPayment[] = [];
  const deposit = Math.max(0, Math.min(q.depositCents, q.totalCents));
  if (deposit > 0) out.push({ kind: "deposit", label: "Acompte à la signature", amountCents: deposit, dueDate: q.acceptedOn });
  const balance = q.totalCents - deposit;
  if (balance > 0) {
    let due = q.eventDate ? addDays(q.eventDate, -(q.balanceDueDays ?? 0)) : q.acceptedOn;
    if (due < q.acceptedOn) due = q.acceptedOn;
    out.push({ kind: "balance", label: q.balanceDueDays ? `Solde, ${q.balanceDueDays} jours avant` : "Solde le jour de l'évènement", amountCents: balance, dueDate: due });
  }
  return out;
}

export type PaymentState = "paid" | "overdue" | "due_soon" | "upcoming";

export function paymentState(item: { dueDate: string; paidAt: string | null }, today: string, soonDays = 7): PaymentState {
  if (item.paidAt) return "paid";
  if (item.dueDate < today) return "overdue";
  if (item.dueDate <= addDays(today, soonDays)) return "due_soon";
  return "upcoming";
}

/** Reminder moments: a week before, on the day, and the day after if still unpaid. */
export function reminderDue(item: { dueDate: string; paidAt: string | null }, today: string): "week_before" | "due_today" | "overdue" | null {
  if (item.paidAt) return null;
  if (item.dueDate === addDays(today, 7)) return "week_before";
  if (item.dueDate === today) return "due_today";
  if (item.dueDate === addDays(today, -1)) return "overdue";
  return null;
}

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = { paid: "Payé", overdue: "En retard", due_soon: "À payer bientôt", upcoming: "À venir" };
