import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { auditLogs, childAuthorizedPersons, childEmergencyContacts, childSensitiveInformation, eventChildren, events, notifications, retentionJobs, sessions, users, verifications } from "@/db/schema";
import { logger } from "@/lib/logger";
import { anonymizeChildrenForEndedEvents } from "@/modules/childcare/application/retention";
import { createSystemErasureRequest } from "@/modules/privacy/application/dsr-service";
import { getRetentionSettings, type RetentionSettings } from "@/modules/privacy/application/settings";

/**
 * Retention policies, run daily by the worker. Each policy is journaled in
 * `retention_jobs` (status, affected rows, error) so the register can prove
 * that the configured durations are applied. A failing policy never blocks the
 * others.
 */
export type RetentionResult = { policy: string; affected: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const monthsAgo = (months: number, now: Date) => new Date(now.getTime() - months * 30 * DAY_MS);

/**
 * Minimal, module-local anonymisation. The childcare module may ship a richer
 * version (`anonymizeChildrenForEndedEvents` in modules/childcare/application/retention);
 * it is preferred when present (dynamic import, tolerant to its absence).
 */
export async function anonymizeChildrenForEndedEventsFallback(daysAfterEvent: number, now: Date, executor: DbExecutor = db): Promise<number> {
  const cutoff = new Date(now.getTime() - daysAfterEvent * DAY_MS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  // "Ended" is decided by the date, never by the status alone: an archived
  // future event keeps its roster until the day has actually passed.
  const children = await executor
    .select({ id: eventChildren.id })
    .from(eventChildren)
    .innerJoin(events, eq(events.id, eventChildren.eventId))
    .where(and(isNull(eventChildren.anonymizedAt), or(lt(events.endsAt, cutoff), and(isNull(events.endsAt), lt(events.eventDate, cutoffDate)))));
  if (children.length === 0) return 0;
  const ids = children.map((c) => c.id);
  await executor.delete(childSensitiveInformation).where(inArray(childSensitiveInformation.childId, ids));
  await executor.delete(childEmergencyContacts).where(inArray(childEmergencyContacts.childId, ids));
  await executor.delete(childAuthorizedPersons).where(inArray(childAuthorizedPersons.childId, ids));
  await executor
    .update(eventChildren)
    .set({ firstName: "Enfant", lastName: "", guardianName: "Anonymisé", guardianPhone: "", guardianEmail: null, careInstructions: null, dietaryPreference: null, anonymizedAt: now })
    .where(inArray(eventChildren.id, ids));
  return ids.length;
}

async function anonymizeChildren(settings: RetentionSettings, now: Date): Promise<number> {
  // The childcare module owns the richer implementation (assignments, access logs); the fallback stays for unit/integration tests.
  return anonymizeChildrenForEndedEvents(settings.childrenDaysAfterEvent, db, now);
}

type Policy = { name: string; run: (settings: RetentionSettings, now: Date) => Promise<number> };

const POLICIES: Policy[] = [
  { name: "children_anonymisation", run: anonymizeChildren },
  {
    name: "sessions_purge",
    run: async (_s, now) => {
      const rows = await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ id: sessions.id });
      return rows.length;
    },
  },
  {
    name: "verifications_purge",
    run: async (_s, now) => {
      const rows = await db.delete(verifications).where(lt(verifications.expiresAt, now)).returning({ id: verifications.id });
      return rows.length;
    },
  },
  {
    name: "notifications_purge",
    run: async (s, now) => {
      const cutoff = new Date(now.getTime() - s.readNotificationsDays * DAY_MS);
      const rows = await db.delete(notifications).where(lt(notifications.readAt, cutoff)).returning({ id: notifications.id });
      return rows.length;
    },
  },
  {
    name: "logs_purge",
    run: async (s, now) => {
      const rows = await db.delete(auditLogs).where(lt(auditLogs.createdAt, monthsAgo(s.auditLogsMonths, now))).returning({ id: auditLogs.id });
      return rows.length;
    },
  },
  {
    name: "inactive_accounts",
    run: async (s, now) => {
      const cutoff = monthsAgo(s.inactiveAccountMonths, now);
      // Inactive = no login since the cutoff (or never, and created before it). Demo and staff accounts are excluded.
      const candidates = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(and(eq(users.isDemo, false), eq(users.role, "user"), or(lt(users.lastLoginAt, cutoff), and(isNull(users.lastLoginAt), lt(users.createdAt, cutoff)))))
        .limit(500);
      let created = 0;
      for (const u of candidates) {
        if (await createSystemErasureRequest(u, `Compte inactif depuis plus de ${s.inactiveAccountMonths} mois (politique de rétention).`)) created += 1;
      }
      return created;
    },
  },
];

export async function runRetentionPolicies(now = new Date()): Promise<RetentionResult[]> {
  const settings = await getRetentionSettings();
  const results: RetentionResult[] = [];
  for (const policy of POLICIES) {
    const [job] = await db.insert(retentionJobs).values({ policy: policy.name, status: "running", startedAt: now }).returning({ id: retentionJobs.id });
    try {
      const affected = await policy.run(settings, now);
      if (job) await db.update(retentionJobs).set({ status: "succeeded", affectedCount: affected, finishedAt: new Date() }).where(eq(retentionJobs.id, job.id));
      results.push({ policy: policy.name, affected });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ policy: policy.name, err: message }, "retention policy failed");
      if (job) await db.update(retentionJobs).set({ status: "failed", error: message.slice(0, 500), finishedAt: new Date() }).where(eq(retentionJobs.id, job.id));
      results.push({ policy: policy.name, affected: 0 });
    }
  }
  return results;
}

/** Last run per policy, for the admin register. */
export async function listRetentionJobs(limit = 50) {
  return db.select().from(retentionJobs).orderBy(sql`${retentionJobs.createdAt} desc`).limit(limit);
}
