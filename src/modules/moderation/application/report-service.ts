import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { appeals, moderationCases, moderationDecisions, reports, users } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { openModerationCase } from "@/modules/moderation/application/moderation-service";
import { notify } from "@/modules/notifications/application/notification-service";
import { recordAudit } from "@/modules/admin/application/audit";

export const REPORT_REASONS = ["inappropriate", "fraud", "fake_review", "spam", "safety", "legal", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  inappropriate: "Contenu inapproprié",
  fraud: "Fraude ou arnaque",
  fake_review: "Faux avis",
  spam: "Spam",
  safety: "Sécurité (enfants, personnes)",
  legal: "Problème juridique",
  other: "Autre",
};

/**
 * CONTRACT for other modules (public report form, message report button):
 * records the report and opens/links a moderation case. Anonymous reports keep
 * only the e-mail given by the reporter.
 */
export type FileReportInput = { resourceType: "professional" | "review" | "message" | "user" | "page"; resourceId: string; reason: ReportReason; details?: string | null; reporterUserId?: string | null; reporterEmail?: string | null; professionalId?: string | null };

export async function fileReport(input: FileReportInput, executor: DbExecutor = db): Promise<{ reportId: string; caseId: string }> {
  if (!REPORT_REASONS.includes(input.reason)) throw new ValidationError("Motif de signalement invalide.");
  const { caseId } = await openModerationCase(
    { kind: "report", resourceType: input.resourceType, resourceId: input.resourceId, professionalId: input.professionalId ?? null, openedByUserId: input.reporterUserId ?? null, summary: `Signalement (${REPORT_REASON_LABELS[input.reason]}) sur ${input.resourceType}.` },
    executor,
  );
  const [row] = await executor
    .insert(reports)
    .values({ reporterUserId: input.reporterUserId ?? null, reporterEmail: input.reporterEmail ?? null, resourceType: input.resourceType, resourceId: input.resourceId, reason: input.reason, details: input.details?.slice(0, 2000) ?? null, caseId })
    .returning({ id: reports.id });
  if (!row) throw new Error("report insert failed");
  return { reportId: row.id, caseId };
}

export async function listReports(actor: Actor, opts: { open?: boolean; limit?: number } = {}) {
  requireGlobalPermission(actor, "moderation.queue");
  const rows = await db
    .select({
      id: reports.id,
      resourceType: reports.resourceType,
      resourceId: reports.resourceId,
      reason: reports.reason,
      details: reports.details,
      reporterEmail: reports.reporterEmail,
      reporterName: users.name,
      caseId: reports.caseId,
      caseStatus: moderationCases.status,
      professionalId: moderationCases.professionalId,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterUserId))
    .leftJoin(moderationCases, eq(moderationCases.id, reports.caseId))
    .where(opts.open ? inArray(moderationCases.status, ["open", "in_review"]) : undefined)
    .orderBy(desc(reports.createdAt))
    .limit(opts.limit ?? 200);
  return rows;
}

export async function countOpenReports(executor: DbExecutor = db): Promise<number> {
  const [r] = await executor
    .select({ n: count() })
    .from(reports)
    .leftJoin(moderationCases, eq(moderationCases.id, reports.caseId))
    .where(inArray(moderationCases.status, ["open", "in_review"]));
  return r?.n ?? 0;
}

/** A report filed without a case (legacy / external import) gets one. */
export async function ensureReportCase(actor: Actor, reportId: string): Promise<{ caseId: string }> {
  requireGlobalPermission(actor, "moderation.decide");
  const [r] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!r) throw new NotFoundError();
  if (r.caseId) return { caseId: r.caseId };
  const { caseId } = await openModerationCase({ kind: "report", resourceType: r.resourceType, resourceId: r.resourceId, openedByUserId: r.reporterUserId, summary: `Signalement (${r.reason}).` });
  await db.update(reports).set({ caseId }).where(eq(reports.id, reportId));
  return { caseId };
}

/**
 * Motivated answer to the reporter (in-app notification when the reporter has
 * an account; the e-mail of anonymous reporters is kept for a manual reply).
 */
export async function answerReporter(actor: Actor, reportId: string, message: string): Promise<void> {
  requireGlobalPermission(actor, "moderation.decide");
  if (message.trim().length < 10) throw new ValidationError("Réponse trop courte.");
  const [r] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!r) throw new NotFoundError();
  await db.transaction(async (tx) => {
    if (r.caseId) await tx.insert(moderationDecisions).values({ caseId: r.caseId, decision: "note", reason: `Réponse au signalant : ${message.trim()}`, decidedByUserId: actor.userId });
    if (r.reporterUserId) {
      await notify({ userId: r.reporterUserId, type: "system", title: "Suite donnée à votre signalement", body: message.trim(), href: "/app/notifications" }, tx);
    }
    await recordAudit(tx, { actorUserId: actor.userId, action: "moderation.report.answered", resourceType: "report", resourceId: reportId, metadata: { hasAccount: Boolean(r.reporterUserId) } });
  });
}

// ── Appeals ──────────────────────────────────────────────────────────────────
/** CONTRACT: a professional contests a decision on one of their cases. */
export async function fileAppeal(actor: Actor, caseId: string, argument: string, executor: DbExecutor = db): Promise<{ appealId: string }> {
  if (argument.trim().length < 20) throw new ValidationError("Expliquez votre recours en au moins 20 caractères.");
  const [c] = await executor.select({ id: moderationCases.id, status: moderationCases.status }).from(moderationCases).where(eq(moderationCases.id, caseId)).limit(1);
  if (!c) throw new NotFoundError();
  const [open] = await executor.select({ id: appeals.id }).from(appeals).where(and(eq(appeals.caseId, caseId), eq(appeals.appellantUserId, actor.userId), eq(appeals.status, "open"))).limit(1);
  if (open) throw new ConflictError("Un recours est déjà en cours sur ce dossier.");
  const [row] = await executor.insert(appeals).values({ caseId, appellantUserId: actor.userId, argument: argument.trim().slice(0, 4000) }).returning({ id: appeals.id });
  if (!row) throw new Error("appeal insert failed");
  await executor.update(moderationCases).set({ status: "in_review", resolvedAt: null }).where(eq(moderationCases.id, caseId));
  return { appealId: row.id };
}

export async function listAppeals(actor: Actor, opts: { open?: boolean } = {}) {
  requireGlobalPermission(actor, "moderation.queue");
  return db
    .select({ id: appeals.id, caseId: appeals.caseId, argument: appeals.argument, status: appeals.status, decisionReason: appeals.decisionReason, decidedAt: appeals.decidedAt, createdAt: appeals.createdAt, appellantName: users.name, appellantEmail: users.email, caseKind: moderationCases.kind, professionalId: moderationCases.professionalId })
    .from(appeals)
    .innerJoin(users, eq(users.id, appeals.appellantUserId))
    .innerJoin(moderationCases, eq(moderationCases.id, appeals.caseId))
    .where(opts.open ? eq(appeals.status, "open") : undefined)
    .orderBy(desc(appeals.createdAt));
}

/**
 * Accepting an appeal does not silently reverse the original decision: it
 * records the acceptance and the moderator then issues a new decision on the
 * case (reinstate, approve…) with its own reason. Rejecting closes the appeal.
 */
export async function decideAppeal(actor: Actor, appealId: string, outcome: "accepted" | "rejected", reason: string): Promise<void> {
  requireGlobalPermission(actor, "moderation.decide");
  if (reason.trim().length < 10) throw new ValidationError("Motivez la décision (10 caractères minimum).");
  const [a] = await db.select().from(appeals).where(and(eq(appeals.id, appealId), eq(appeals.status, "open"))).limit(1);
  if (!a) throw new NotFoundError();
  await db.transaction(async (tx) => {
    await tx.update(appeals).set({ status: outcome, decidedByUserId: actor.userId, decisionReason: reason.trim(), decidedAt: new Date() }).where(eq(appeals.id, appealId));
    await tx.insert(moderationDecisions).values({ caseId: a.caseId, decision: outcome === "accepted" ? "escalate" : "dismiss", reason: `Recours ${outcome === "accepted" ? "accepté" : "rejeté"} : ${reason.trim()}`, decidedByUserId: actor.userId });
    if (outcome === "rejected") {
      const [stillOpen] = await tx.select({ id: appeals.id }).from(appeals).where(and(eq(appeals.caseId, a.caseId), eq(appeals.status, "open"), isNull(appeals.decidedAt))).limit(1);
      if (!stillOpen) await tx.update(moderationCases).set({ status: "resolved", resolvedAt: new Date() }).where(eq(moderationCases.id, a.caseId));
    }
    await notify({ userId: a.appellantUserId, type: "system", title: outcome === "accepted" ? "Votre recours est accepté" : "Votre recours n'a pas été retenu", body: reason.trim(), href: "/app/notifications" }, tx);
    await recordAudit(tx, { actorUserId: actor.userId, action: `moderation.appeal.${outcome}`, resourceType: "appeal", resourceId: appealId, metadata: { caseId: a.caseId }, reason: reason.trim() });
  });
}
