import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import {
  appeals,
  moderationCases,
  moderationDecisions,
  professionalCategories,
  professionalDocuments,
  professionalVerifications,
  professionals,
  profileVersions,
  publicProfiles,
  reports,
  users,
} from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { caseStatusAfter, closesCase, targetProfessionalStatus, validateReason, type Decision } from "@/modules/moderation/domain/decisions";
import { setListingStatusAsModerator } from "@/modules/professionals/application/professional-service";
import { setVerification } from "@/modules/professionals/application/verification-service";
import type { ProfessionalStatus } from "@/modules/professionals/domain/status";
import type { VerificationKind } from "@/modules/professionals/domain/verification";
import { notify } from "@/modules/notifications/application/notification-service";
import { recordAudit } from "@/modules/admin/application/audit";

/**
 * Contract used by other modules to open a moderation case (profile submitted,
 * report filed, review posted). The review UI and decision workflow live in the
 * administration module.
 */
export type OpenCaseInput = {
  kind: "profile_review" | "profile_update_review" | "report" | "review_moderation" | "appeal";
  resourceType: string;
  resourceId: string;
  professionalId?: string | null;
  openedByUserId?: string | null;
  summary?: string;
};

export async function openModerationCase(input: OpenCaseInput, executor: DbExecutor = db): Promise<{ caseId: string }> {
  // One open case per resource+kind: a second submission updates the summary instead of duplicating the queue entry.
  const [existing] = await executor
    .select({ id: moderationCases.id })
    .from(moderationCases)
    .where(and(eq(moderationCases.kind, input.kind), eq(moderationCases.resourceType, input.resourceType), eq(moderationCases.resourceId, input.resourceId), inArray(moderationCases.status, ["open", "in_review"])))
    .limit(1);
  if (existing) {
    if (input.summary) await executor.update(moderationCases).set({ summary: input.summary }).where(eq(moderationCases.id, existing.id));
    return { caseId: existing.id };
  }
  const [row] = await executor
    .insert(moderationCases)
    .values({
      kind: input.kind,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      professionalId: input.professionalId ?? null,
      openedByUserId: input.openedByUserId ?? null,
      summary: input.summary ?? null,
    })
    .returning({ id: moderationCases.id });
  if (!row) throw new Error("failed to open moderation case");
  return { caseId: row.id };
}

// ── Queue ────────────────────────────────────────────────────────────────────
export type CaseFilter = { status?: "open" | "in_review" | "resolved" | "dismissed" | "active"; kind?: string; assignedToUserId?: string | "me" | "unassigned"; limit?: number };

export async function listCases(actor: Actor, filter: CaseFilter = {}) {
  requireGlobalPermission(actor, "moderation.queue");
  const conds = [];
  const status = filter.status ?? "active";
  if (status === "active") conds.push(inArray(moderationCases.status, ["open", "in_review"]));
  else conds.push(eq(moderationCases.status, status));
  if (filter.kind) conds.push(sql`${moderationCases.kind} = ${filter.kind}`);
  if (filter.assignedToUserId === "me") conds.push(eq(moderationCases.assignedToUserId, actor.userId));
  else if (filter.assignedToUserId === "unassigned") conds.push(isNull(moderationCases.assignedToUserId));
  else if (filter.assignedToUserId) conds.push(eq(moderationCases.assignedToUserId, filter.assignedToUserId));
  return db
    .select({
      id: moderationCases.id,
      kind: moderationCases.kind,
      status: moderationCases.status,
      resourceType: moderationCases.resourceType,
      resourceId: moderationCases.resourceId,
      professionalId: moderationCases.professionalId,
      professionalName: professionals.displayName,
      professionalStatus: professionals.status,
      summary: moderationCases.summary,
      assignedToUserId: moderationCases.assignedToUserId,
      assignedToName: users.name,
      createdAt: moderationCases.createdAt,
      resolvedAt: moderationCases.resolvedAt,
    })
    .from(moderationCases)
    .leftJoin(professionals, eq(professionals.id, moderationCases.professionalId))
    .leftJoin(users, eq(users.id, moderationCases.assignedToUserId))
    .where(and(...conds))
    .orderBy(asc(moderationCases.createdAt))
    .limit(filter.limit ?? 200);
}

export async function countOpenCases(executor: DbExecutor = db): Promise<number> {
  const [r] = await executor.select({ n: count() }).from(moderationCases).where(inArray(moderationCases.status, ["open", "in_review"]));
  return r?.n ?? 0;
}

export async function getCaseDetail(actor: Actor, caseId: string) {
  requireGlobalPermission(actor, "moderation.queue");
  const [c] = await db.select().from(moderationCases).where(eq(moderationCases.id, caseId)).limit(1);
  if (!c) throw new NotFoundError();
  const decisions = await db
    .select({ id: moderationDecisions.id, decision: moderationDecisions.decision, reason: moderationDecisions.reason, createdAt: moderationDecisions.createdAt, decidedByName: users.name, decidedByUserId: moderationDecisions.decidedByUserId })
    .from(moderationDecisions)
    .innerJoin(users, eq(users.id, moderationDecisions.decidedByUserId))
    .where(eq(moderationDecisions.caseId, caseId))
    .orderBy(desc(moderationDecisions.createdAt));
  const caseReports = await db.select().from(reports).where(eq(reports.caseId, caseId)).orderBy(desc(reports.createdAt));
  const caseAppeals = await db.select().from(appeals).where(eq(appeals.caseId, caseId)).orderBy(desc(appeals.createdAt));
  const professional = c.professionalId ? await getProfessionalForModeration(c.professionalId) : null;
  const assignee = c.assignedToUserId ? (await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, c.assignedToUserId)).limit(1))[0] ?? null : null;
  return { case: c, decisions, reports: caseReports, appeals: caseAppeals, professional, assignee };
}

/** Everything a moderator needs to read a listing (never the owner's private account data beyond identity). */
export async function getProfessionalForModeration(professionalId: string, executor: DbExecutor = db) {
  const [pro] = await executor
    .select({ pro: professionals, categoryName: professionalCategories.name, categorySlug: professionalCategories.slug, ownerName: users.name, ownerEmail: users.email })
    .from(professionals)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .innerJoin(users, eq(users.id, professionals.ownerUserId))
    .where(eq(professionals.id, professionalId))
    .limit(1);
  if (!pro) return null;
  const verifications = await executor.select().from(professionalVerifications).where(eq(professionalVerifications.professionalId, professionalId)).orderBy(asc(professionalVerifications.kind));
  const documents = await executor.select().from(professionalDocuments).where(eq(professionalDocuments.professionalId, professionalId)).orderBy(desc(professionalDocuments.createdAt));
  const [profile] = await executor.select().from(publicProfiles).where(eq(publicProfiles.professionalId, professionalId)).limit(1);
  const versions = profile ? await executor.select().from(profileVersions).where(eq(profileVersions.publicProfileId, profile.id)).orderBy(desc(profileVersions.versionNumber)).limit(5) : [];
  const submitted = versions.find((v) => v.status === "submitted") ?? null;
  const published = profile?.publishedVersionId ? versions.find((v) => v.id === profile.publishedVersionId) ?? null : null;
  return { ...pro.pro, categoryName: pro.categoryName, categorySlug: pro.categorySlug, ownerName: pro.ownerName, ownerEmail: pro.ownerEmail, verifications, documents, profile: profile ?? null, submittedVersion: submitted, publishedVersion: published };
}

export async function listModeratorsForAssignment(executor: DbExecutor = db) {
  return executor.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.role, ["moderator", "admin", "super_admin"])).orderBy(asc(users.name));
}

export async function assignCase(actor: Actor, caseId: string, assigneeUserId: string | null, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "moderation.decide");
  const [c] = await executor.select({ id: moderationCases.id, status: moderationCases.status }).from(moderationCases).where(eq(moderationCases.id, caseId)).limit(1);
  if (!c) throw new NotFoundError();
  if (c.status === "resolved" || c.status === "dismissed") throw new ConflictError("Ce cas est clos.");
  await executor.update(moderationCases).set({ assignedToUserId: assigneeUserId, status: assigneeUserId ? "in_review" : "open" }).where(eq(moderationCases.id, caseId));
  await recordAudit(executor, { actorUserId: actor.userId, action: "moderation.case.assigned", resourceType: "moderation_case", resourceId: caseId, metadata: { assigneeUserId } });
}

// ── Decisions ────────────────────────────────────────────────────────────────
export type DecideInput = { decision: Decision; reason: string };

/**
 * Appends a motivated decision, applies its effect (listing status, page
 * version, notifications), closes the case when relevant. All in one
 * transaction so a failed notification never leaves a half-applied decision.
 */
export async function decideCase(actor: Actor, caseId: string, input: DecideInput): Promise<{ caseStatus: string; professionalStatus: ProfessionalStatus | null }> {
  requireGlobalPermission(actor, "moderation.decide");
  const reasonError = validateReason(input.decision, input.reason);
  if (reasonError) throw new ValidationError(reasonError);
  const reason = input.reason.trim();

  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(moderationCases).where(eq(moderationCases.id, caseId)).limit(1);
    if (!c) throw new NotFoundError();
    if ((c.status === "resolved" || c.status === "dismissed") && input.decision !== "note") throw new ConflictError("Ce cas est déjà clos.");

    let professionalStatus: ProfessionalStatus | null = null;
    if (c.professionalId && (c.kind === "profile_review" || c.kind === "profile_update_review" || c.kind === "appeal" || c.kind === "report")) {
      professionalStatus = await applyProfessionalDecision(tx, actor, c.professionalId, c.kind, input.decision, reason);
    }

    await tx.insert(moderationDecisions).values({ caseId, decision: input.decision, reason, decidedByUserId: actor.userId });
    const nextStatus = caseStatusAfter(input.decision);
    const closing = closesCase(input.decision);
    await tx
      .update(moderationCases)
      .set({ status: c.status === "resolved" || c.status === "dismissed" ? c.status : nextStatus, resolvedAt: closing ? new Date() : c.resolvedAt, assignedToUserId: c.assignedToUserId ?? (input.decision === "note" ? null : actor.userId) })
      .where(eq(moderationCases.id, caseId));
    if (closing && c.kind === "report") await tx.update(reports).set({ updatedAt: new Date() }).where(eq(reports.caseId, caseId));
    await recordAudit(tx, { actorUserId: actor.userId, action: `moderation.decision.${input.decision}`, resourceType: "moderation_case", resourceId: caseId, metadata: { kind: c.kind, professionalId: c.professionalId, resourceType: c.resourceType, resourceId: c.resourceId }, reason: input.decision === "note" ? null : reason });
    return { caseStatus: closing ? nextStatus : c.status, professionalStatus };
  });
}

async function applyProfessionalDecision(tx: DbExecutor, actor: Actor, professionalId: string, kind: string, decision: Decision, reason: string): Promise<ProfessionalStatus | null> {
  const [pro] = await tx.select({ status: professionals.status, ownerUserId: professionals.ownerUserId }).from(professionals).where(eq(professionals.id, professionalId)).limit(1);
  if (!pro) throw new NotFoundError();
  const current = pro.status as ProfessionalStatus;
  const target = targetProfessionalStatus(decision, current);
  if (!target) return null;

  // Re-review of a published listing: approving keeps it published; requesting changes keeps the published version visible.
  if (kind === "profile_update_review" || kind === "report") {
    if (decision === "approve" && current === "published") {
      await applyVersionDecision(tx, actor, professionalId, "approve", reason);
      await notify({ userId: pro.ownerUserId, type: "profile_approved", title: "Vos modifications sont validées", body: reason, href: `/app/pro/${professionalId}` }, tx);
      return current;
    }
    if (decision === "request_changes" && current === "published") {
      await setListingStatusAsModerator(actor, professionalId, "changes_requested", reason, tx);
      await applyVersionDecision(tx, actor, professionalId, "request_changes", reason);
      return "changes_requested";
    }
  }
  if (target === current) return current;
  await setListingStatusAsModerator(actor, professionalId, target, reason, tx);
  if (decision === "approve") await applyVersionDecision(tx, actor, professionalId, "approve", reason);
  if (decision === "reject") await applyVersionDecision(tx, actor, professionalId, "reject", reason);
  if (decision === "request_changes") await applyVersionDecision(tx, actor, professionalId, "request_changes", reason);
  return target;
}

/**
 * Page version state. The pages module will expose approveVersion /
 * rejectVersion / requestChanges; until then the state machine is applied here
 * on `profile_versions` + `public_profiles` (single place to swap).
 *  - approve: submitted → approved, becomes the published version, previous published → superseded.
 *  - reject / request_changes: submitted → rejected with the note; an already published version stays live.
 */
export async function applyVersionDecision(tx: DbExecutor, actor: Actor, professionalId: string, decision: "approve" | "reject" | "request_changes", note: string): Promise<void> {
  const [profile] = await tx.select().from(publicProfiles).where(eq(publicProfiles.professionalId, professionalId)).limit(1);
  if (!profile) return;
  const [submitted] = await tx.select().from(profileVersions).where(and(eq(profileVersions.publicProfileId, profile.id), eq(profileVersions.status, "submitted"))).orderBy(desc(profileVersions.versionNumber)).limit(1);
  const now = new Date();
  if (decision === "approve") {
    const candidate = submitted ?? (profile.draftVersionId ? (await tx.select().from(profileVersions).where(and(eq(profileVersions.id, profile.draftVersionId), eq(profileVersions.status, "draft"))).limit(1))[0] : undefined);
    if (!candidate) return;
    if (profile.publishedVersionId && profile.publishedVersionId !== candidate.id) {
      await tx.update(profileVersions).set({ status: "superseded" }).where(eq(profileVersions.id, profile.publishedVersionId));
    }
    await tx.update(profileVersions).set({ status: "approved", reviewedAt: now, reviewedByUserId: actor.userId, reviewNote: note }).where(eq(profileVersions.id, candidate.id));
    await tx.update(publicProfiles).set({ publishedVersionId: candidate.id, draftVersionId: profile.draftVersionId === candidate.id ? null : profile.draftVersionId }).where(eq(publicProfiles.id, profile.id));
    return;
  }
  if (!submitted) return;
  await tx.update(profileVersions).set({ status: "rejected", reviewedAt: now, reviewedByUserId: actor.userId, reviewNote: note }).where(eq(profileVersions.id, submitted.id));
}

// ── Verifications (moderator side) ───────────────────────────────────────────
export async function reviewVerification(actor: Actor, professionalId: string, kind: VerificationKind, status: "verified" | "rejected", statement: string, validUntil: Date | null = null): Promise<void> {
  requireGlobalPermission(actor, "moderation.decide");
  if (statement.trim().length < 15) throw new ValidationError("Décrivez précisément ce qui a été vérifié (15 caractères minimum).");
  await db.transaction(async (tx) => {
    await setVerification(professionalId, kind, status, statement.trim().slice(0, 500), actor.userId, validUntil, tx);
    await recordAudit(tx, { actorUserId: actor.userId, action: `professional.verification.${status}`, resourceType: "professional", resourceId: professionalId, metadata: { kind } });
  });
}

export async function reviewDocument(actor: Actor, documentId: string, status: "verified" | "rejected", note: string): Promise<void> {
  requireGlobalPermission(actor, "moderation.decide");
  const [doc] = await db.select({ id: professionalDocuments.id, professionalId: professionalDocuments.professionalId, kind: professionalDocuments.kind }).from(professionalDocuments).where(eq(professionalDocuments.id, documentId)).limit(1);
  if (!doc) throw new NotFoundError();
  await db.transaction(async (tx) => {
    await tx.update(professionalDocuments).set({ status, reviewNote: note.trim().slice(0, 500) || null, reviewedAt: new Date(), reviewedByUserId: actor.userId }).where(eq(professionalDocuments.id, documentId));
    await recordAudit(tx, { actorUserId: actor.userId, action: `professional.document.${status}`, resourceType: "professional", resourceId: doc.professionalId, metadata: { documentId, kind: doc.kind } });
  });
}

/**
 * Direct decision on a listing outside the queue (e.g. suspend from the
 * professional's admin page): opens (or reuses) a case so the decision is
 * historised exactly like a queued one.
 */
export async function decideOnProfessional(actor: Actor, professionalId: string, input: DecideInput): Promise<{ caseId: string }> {
  requireGlobalPermission(actor, "moderation.decide");
  const [pro] = await db.select({ id: professionals.id, displayName: professionals.displayName }).from(professionals).where(eq(professionals.id, professionalId)).limit(1);
  if (!pro) throw new NotFoundError();
  const { caseId } = await openModerationCase({ kind: "profile_update_review", resourceType: "professional", resourceId: professionalId, professionalId, openedByUserId: actor.userId, summary: `Décision directe (${input.decision}) sur « ${pro.displayName} ».` });
  await decideCase(actor, caseId, input);
  return { caseId };
}
