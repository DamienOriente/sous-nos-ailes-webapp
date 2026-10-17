import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { auditLogs, moderationCases, notifications, professionalCategories, professionalServices, professionals, profileVersions, publicProfiles } from "@/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import {
  approveVersion,
  computeCompleteness,
  ensurePublicProfile,
  getDraft,
  getPublishedPage,
  listIndexablePagePaths,
  rejectVersion,
  requestChanges,
  saveDraft,
  submitForReview,
} from "@/modules/pages/application/page-service";
import { cleanupUsers, createUser } from "./_fixtures";

/**
 * Publication workflow against the local database. The listing is created
 * directly (prefix itest-) so this suite does not depend on the professionals
 * seed. Cleanup removes everything it created.
 */
let owner: Actor;
let stranger: Actor;
let moderator: Actor;
let professionalId: string;
let slug: string;

async function heroTitle(content: unknown): Promise<string | undefined> {
  const hero = (content as Array<{ type: string; props: { title?: string } }>).find((b) => b.type === "hero");
  return hero?.props.title;
}

beforeAll(async () => {
  owner = await createUser("pro-owner");
  stranger = await createUser("stranger");
  moderator = await createUser("moderator", "moderator");
  const [cat] = await db.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, "garde-enfants-evenementielle")).limit(1);
  if (!cat) throw new Error("categories missing: run the reference seed first");
  slug = `itest-pages-${randomUUID().slice(0, 8)}`;
  const [pro] = await db
    .insert(professionals)
    .values({ ownerUserId: owner.userId, slug, displayName: "Itest Garde", tagline: "Garde sereine", description: "Texte de test pour la page.", primaryCategoryId: cat.id, status: "draft", city: "Toulouse", department: "31", publicEmail: "itest@sousnosailes.test", isDemo: false })
    .returning({ id: professionals.id });
  professionalId = pro!.id;
  await db.insert(professionalServices).values({ professionalId, name: "Espace enfants", priceCents: 42000, priceUnit: "la soirée" });
});

afterAll(async () => {
  await db.delete(moderationCases).where(eq(moderationCases.professionalId, professionalId));
  await db.delete(auditLogs).where(and(eq(auditLogs.resourceType, "profile_version"), inArray(auditLogs.actorUserId, [owner.userId, moderator.userId])));
  await db.delete(notifications).where(eq(notifications.userId, owner.userId));
  await db.delete(professionals).where(eq(professionals.id, professionalId)); // cascades public_profiles + versions
  await cleanupUsers([owner, stranger, moderator]);
});

describe("public page lifecycle", () => {
  it("ensurePublicProfile creates the profile and a generated v1 draft, idempotently", async () => {
    const a = await ensurePublicProfile(professionalId, "nid-douillet");
    const b = await ensurePublicProfile(professionalId);
    expect(a).toEqual(b);
    const [v] = await db.select().from(profileVersions).where(eq(profileVersions.id, a.draftVersionId));
    expect(v?.status).toBe("draft");
    expect(v?.templateKey).toBe("nid-douillet");
    expect(await heroTitle(v?.content)).toBe("Itest Garde");
  });

  it("denies access to non-managers with NotFound and lets the owner read the draft", async () => {
    await expect(getDraft(stranger, professionalId)).rejects.toBeInstanceOf(NotFoundError);
    const state = await getDraft(owner, professionalId);
    expect(state.published).toBeNull();
    expect(state.draft.versionNumber).toBe(1);
    expect(state.renderData.services).toHaveLength(1);
    expect(state.completeness.score).toBeGreaterThan(0);
  });

  it("saveDraft validates and stores content; premium template refused on the free plan", async () => {
    const state = await getDraft(owner, professionalId);
    const content = state.draft.content.map((b) => (b.type === "hero" ? { ...b, props: { ...b.props, title: "Itest Garde v1" } } : b));
    const saved = await saveDraft(owner, professionalId, { content, seoTitle: "Itest Garde – Garde d'enfants à Toulouse" });
    expect(saved.versionNumber).toBe(1);
    await expect(saveDraft(owner, professionalId, { content: [{ id: "x", type: "hero", hidden: false, props: { title: "<b>x</b>" } }] })).rejects.toMatchObject({ code: "validation" });
    await expect(saveDraft(owner, professionalId, { templateKey: "editorial-luxe" })).rejects.toMatchObject({ code: "validation" });
    await expect(saveDraft(stranger, professionalId, { seoTitle: "x" })).rejects.toBeInstanceOf(NotFoundError);
    const sw = await saveDraft(owner, professionalId, { templateKey: "sauge-elegante" });
    expect(sw.versionNumber).toBe(1);
  });

  it("submitForReview opens a moderation case and freezes the version", async () => {
    const res = await submitForReview(owner, professionalId);
    const [c] = await db.select().from(moderationCases).where(eq(moderationCases.id, res.caseId));
    expect(c?.kind).toBe("profile_review");
    expect(c?.resourceType).toBe("profile_version");
    expect(c?.resourceId).toBe(res.versionId);
    const [v] = await db.select().from(profileVersions).where(eq(profileVersions.id, res.versionId));
    expect(v?.status).toBe("submitted");
    const [p] = await db.select({ status: professionals.status }).from(professionals).where(eq(professionals.id, professionalId));
    expect(p?.status).toBe("pending_review");
    await expect(submitForReview(owner, professionalId)).rejects.toMatchObject({ code: "conflict" });
    expect(await getPublishedPage(slug)).toBeNull();
  });

  it("only moderators can decide; approval publishes and marks the listing indexable", async () => {
    const state = await getDraft(owner, professionalId);
    await expect(approveVersion(owner, state.draft.id)).rejects.toBeInstanceOf(ForbiddenError);
    await approveVersion(moderator, state.draft.id, "OK");
    const [profile] = await db.select().from(publicProfiles).where(eq(publicProfiles.professionalId, professionalId));
    expect(profile?.publishedVersionId).toBe(state.draft.id);
    expect(profile?.isIndexable).toBe(true);
    const [pro] = await db.select({ status: professionals.status, publishedAt: professionals.publishedAt }).from(professionals).where(eq(professionals.id, professionalId));
    expect(pro?.status).toBe("published");
    expect(pro?.publishedAt).toBeInstanceOf(Date);
    const page = await getPublishedPage(slug);
    expect(page?.data.templateKey).toBe("sauge-elegante");
    expect(await heroTitle(page?.data.content)).toBe("Itest Garde v1");
    expect(page?.data.seoTitle).toBe("Itest Garde – Garde d'enfants à Toulouse");
    const paths = await listIndexablePagePaths();
    expect(paths.map((p) => p.path)).toContain(`/pro/${slug}`);
    const [log] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "profile_version.approved"), eq(auditLogs.resourceId, state.draft.id)));
    expect(log?.actorUserId).toBe(moderator.userId);
  });

  it("editing after publication clones a new draft; the published page stays visible during re-submission", async () => {
    const before = await getDraft(owner, professionalId);
    expect(before.draft.versionNumber).toBe(1);
    expect(before.pendingReview).toBe(false);
    const content = before.draft.content.map((b) => (b.type === "hero" ? { ...b, props: { ...b.props, title: "Itest Garde v2" } } : b));
    const saved = await saveDraft(owner, professionalId, { content });
    expect(saved.versionNumber).toBe(2);
    const after = await getDraft(owner, professionalId);
    expect(after.draft.versionNumber).toBe(2);
    expect(after.published?.versionNumber).toBe(1);

    const res = await submitForReview(owner, professionalId);
    const [c] = await db.select().from(moderationCases).where(eq(moderationCases.id, res.caseId));
    expect(c?.kind).toBe("profile_update_review");
    const page = await getPublishedPage(slug);
    expect(await heroTitle(page?.data.content)).toBe("Itest Garde v1");
    const [pro] = await db.select({ status: professionals.status }).from(professionals).where(eq(professionals.id, professionalId));
    expect(pro?.status).toBe("published");

    await requestChanges(moderator, res.versionId, "Précisez les tarifs.");
    const mid = await getDraft(owner, professionalId);
    expect(mid.draft.status).toBe("draft");
    expect(mid.draft.reviewNote).toBe("Précisez les tarifs.");
    expect(await heroTitle((await getPublishedPage(slug))?.data.content)).toBe("Itest Garde v1");

    await submitForReview(owner, professionalId);
    await approveVersion(moderator, res.versionId);
    const live = await getPublishedPage(slug);
    expect(await heroTitle(live?.data.content)).toBe("Itest Garde v2");
    const [v1] = await db.select({ status: profileVersions.status }).from(profileVersions).where(eq(profileVersions.id, before.draft.id));
    expect(v1?.status).toBe("superseded");
  });

  it("a rejected update never touches the live page", async () => {
    const state = await getDraft(owner, professionalId);
    await saveDraft(owner, professionalId, { seoDescription: "Nouvelle description de test suffisamment longue pour passer le contrôle de longueur." });
    const res = await submitForReview(owner, professionalId);
    await expect(rejectVersion(moderator, res.versionId, "")).rejects.toMatchObject({ code: "validation" });
    await rejectVersion(moderator, res.versionId, "Contenu insuffisant.");
    const live = await getPublishedPage(slug);
    expect(await heroTitle(live?.data.content)).toBe("Itest Garde v2");
    expect(live?.data.seoDescription).toBeNull();
    const next = await getDraft(owner, professionalId);
    expect(next.draft.status).toBe("rejected");
    expect(next.published?.versionNumber).toBe(state.published?.versionNumber);
    // Editing again starts a fresh draft from the rejected one.
    const saved = await saveDraft(owner, professionalId, { seoTitle: "Encore un titre de test" });
    expect(saved.versionNumber).toBeGreaterThan(next.draft.versionNumber);
  });

  it("computeCompleteness loads the catalogue count", async () => {
    const [pro] = await db.select().from(professionals).where(eq(professionals.id, professionalId));
    const state = await getDraft(owner, professionalId);
    const [v] = await db.select().from(profileVersions).where(eq(profileVersions.id, state.draft.id));
    const c = await computeCompleteness(pro!, v!);
    expect(c.recommendations.find((r) => r.kind === "services")?.satisfied).toBe(true);
    expect(c.score).toBeGreaterThan(20);
  });
});
