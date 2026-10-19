export const MAX_REMINDERS = 2;
export const MIN_REMINDER_INTERVAL_DAYS = 7;

export type ReminderDecision = { ok: true } | { ok: false; reason: "status" | "max_reached" | "too_soon" | "no_email"; retryAfter?: Date };

/** Reasonable reminder policy: only for unanswered sent/viewed invitations, max 2, 7 days apart. */
export function canSendReminder(input: { status: string; reminderCount: number; lastReminderAt: Date | null; sentAt: Date | null; recipientEmail: string | null; now?: Date }): ReminderDecision {
  if (!input.recipientEmail) return { ok: false, reason: "no_email" };
  if (input.status !== "sent" && input.status !== "viewed") return { ok: false, reason: "status" };
  if (input.reminderCount >= MAX_REMINDERS) return { ok: false, reason: "max_reached" };
  const now = input.now ?? new Date();
  const reference = input.lastReminderAt ?? input.sentAt;
  if (reference) {
    const next = new Date(reference.getTime() + MIN_REMINDER_INTERVAL_DAYS * 86_400_000);
    if (next.getTime() > now.getTime()) return { ok: false, reason: "too_soon", retryAfter: next };
  }
  return { ok: true };
}
