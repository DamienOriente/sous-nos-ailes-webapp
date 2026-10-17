import { inArray } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { configurationSettings } from "@/db/schema";

export type RetentionSettings = {
  childrenDaysAfterEvent: number;
  inactiveAccountMonths: number;
  auditLogsMonths: number;
  /** Fixed in code: not a business decision, just hygiene. */
  readNotificationsDays: number;
};

const DEFAULTS: RetentionSettings = { childrenDaysAfterEvent: 30, inactiveAccountMonths: 36, auditLogsMonths: 12, readNotificationsDays: 180 };

const KEYS = {
  childrenDaysAfterEvent: "retention.children_days_after_event",
  inactiveAccountMonths: "retention.inactive_account_months",
  auditLogsMonths: "retention.audit_logs_months",
} as const;

function asPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Retention delays are editable in the back-office; invalid values fall back to the documented defaults. */
export async function getRetentionSettings(executor: DbExecutor = db): Promise<RetentionSettings> {
  const rows = await executor
    .select({ key: configurationSettings.key, value: configurationSettings.value })
    .from(configurationSettings)
    .where(inArray(configurationSettings.key, Object.values(KEYS)));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    childrenDaysAfterEvent: asPositiveInt(byKey.get(KEYS.childrenDaysAfterEvent), DEFAULTS.childrenDaysAfterEvent),
    inactiveAccountMonths: asPositiveInt(byKey.get(KEYS.inactiveAccountMonths), DEFAULTS.inactiveAccountMonths),
    auditLogsMonths: asPositiveInt(byKey.get(KEYS.auditLogsMonths), DEFAULTS.auditLogsMonths),
    readNotificationsDays: DEFAULTS.readNotificationsDays,
  };
}
