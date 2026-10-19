import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { consentRecords } from "@/db/schema";
import { CONSENT_POLICY_VERSION, CONSENT_PURPOSES, truncateIp, type ConsentChoices } from "@/modules/privacy/domain/consent";

export type RecordConsentInput = {
  anonymousId: string;
  userId?: string | null;
  choices: ConsentChoices;
  /** Previous choices, to mark a switch from granted → denied as "withdrawn". */
  previous?: ConsentChoices | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** Writes one proof row per cookie category. Idempotent enough: a repeated identical choice is still a new timestamped proof. */
export async function recordCookieConsent(input: RecordConsentInput, executor: DbExecutor = db): Promise<void> {
  const rows = (Object.keys(CONSENT_PURPOSES) as Array<keyof ConsentChoices>).map((category) => {
    const granted = input.choices[category];
    const was = input.previous?.[category] ?? false;
    const state: "granted" | "denied" | "withdrawn" = granted ? "granted" : was ? "withdrawn" : "denied";
    return {
      userId: input.userId ?? null,
      anonymousId: input.anonymousId,
      purpose: CONSENT_PURPOSES[category],
      granted: state,
      policyVersion: CONSENT_POLICY_VERSION,
      ipAddress: truncateIp(input.ipAddress),
      userAgent: input.userAgent?.slice(0, 200) ?? null,
    };
  });
  await executor.insert(consentRecords).values(rows);
}

/** History shown to the person: their account rows plus the anonymous rows of their current consent cookie. */
export async function listConsentHistory(userId: string, anonymousId: string | null, executor: DbExecutor = db) {
  const where = anonymousId
    ? or(eq(consentRecords.userId, userId), and(isNull(consentRecords.userId), eq(consentRecords.anonymousId, anonymousId)))
    : eq(consentRecords.userId, userId);
  return executor
    .select({
      id: consentRecords.id,
      purpose: consentRecords.purpose,
      granted: consentRecords.granted,
      policyVersion: consentRecords.policyVersion,
      createdAt: consentRecords.createdAt,
      anonymous: isNull(consentRecords.userId),
    })
    .from(consentRecords)
    .where(where)
    .orderBy(desc(consentRecords.createdAt))
    .limit(200);
}

/** Current analytics consent for an anonymous visitor, from the proof table (the cookie is the fast path). */
export async function hasAnalyticsConsent(anonymousId: string, executor: DbExecutor = db): Promise<boolean> {
  const [row] = await executor
    .select({ granted: consentRecords.granted })
    .from(consentRecords)
    .where(and(eq(consentRecords.anonymousId, anonymousId), eq(consentRecords.purpose, CONSENT_PURPOSES.analytics)))
    .orderBy(desc(consentRecords.createdAt))
    .limit(1);
  return row?.granted === "granted";
}
