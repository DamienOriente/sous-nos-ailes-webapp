import { logger } from "@/lib/logger";
import { dispatchDueReminders } from "@/modules/calendar/application/reminders";

export const REMINDERS_EVERY_MS = 5 * 60_000;

export async function processRemindersJob(): Promise<{ dispatched: number }> {
  const dispatched = await dispatchDueReminders();
  if (dispatched) logger.info({ dispatched }, "reminders dispatched");
  return { dispatched };
}
