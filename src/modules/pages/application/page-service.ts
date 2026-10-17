import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import {
  auditLogs,
  files,
  professionalAvailability,
  professionalCategories,
  professionalReviews,
  professionalServices,
  professionalVerifications,
  professionals,
  profileVersions,
  publicProfiles,
  users,
} from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission, requireProfessionalManage } from "@/modules/authorization";
import { hasFeature } from "@/modules/billing/application/entitlements";
import { openModerationCase } from "@/modules/moderation/application/moderation-service";
import { notify } from "@/modules/notifications/application/notification-service";
import { computeCompleteness as computeCompletenessPure, type Completeness } from "@/modules/pages/domain/completeness";
import { generateDefaultContent, mergeContentForTemplate } from "@/modules/pages/domain/default-content";
import { migrateContent, pageContentSchema, parseContent, parseTheme, SCHEMA_VERSION, seoFieldsSchema, type PageContent, type PageTheme } from "@/modules/pages/domain/page-schema";
import type { PageRenderData, ProfessionalSnapshot } from "@/modules/pages/domain/render-data";
import { getTemplate, getTemplateOrDefault, isFreeTemplate } from "@/modules/pages/templates/registry";

/**
 * Public page lifecycle: one public_profiles row per listing, many
 * profile_versions. `draftVersionId` is what the professional edits,
 * `publishedVersionId` is what visitors see. Approving a version never removes
 * the previous one until the new one is live (swap in one transaction), and a
 * re-submission never touches the published version.
 */
type ProfessionalRow = typeof professionals.$inferSelect;
type CategoryRow = typeof professionalCategories.$inferSelect;
type VersionRow = typeof profileVersions.$inferSelect;
type PublicProfileRow = typeof publicProfiles.$inferSelect;

export type VersionSummary = {
  id: string;
  versionNumber: number;
  status: VersionRow["status"];
  templateKey: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  updatedAt: string;
};

export type DraftState = {
  publicProfileId: string;
  slug: string;
  isIndexable: boolean;
  viewCount: number;
  draft: VersionSummary & { theme: PageTheme; content: PageContent; seoTitle: string | null; seoDescription: string | null };
  published: VersionSummary | null;
  /** True when the draft is the version currently under moderation. */
  pendingReview: boolean;
  renderData: PageRenderData;
  access: TemplateAccess;
  completeness: Completeness;
  suggestedTemplates: string[];
};

export type TemplateAccess = { canUseAllTemplates: boolean; canCustomize: boolean; canUseSeoAssistant: boolean };

// ── Snapshot helpers ────────────────────────────────────────────────────────
export function toSnapshot(pro: ProfessionalRow, cat: Pick<CategoryRow, "name" | "slug" | "group">): ProfessionalSnapshot {
  return {
    id: pro.id,
    slug: pro.slug,
    displayName: pro.displayName,
    tagline: pro.tagline,
    description: pro.description,
    categoryName: cat.name,
    categorySlug: cat.slug,
    categoryGroup: cat.group,
    city: pro.city,
    postalCode: pro.postalCode,
    department: pro.department,
    region: pro.region,
    interventionRadiusKm: pro.interventionRadiusKm,
    priceFromCents: pro.priceFromCents,
    priceToCents: pro.priceToCents,
    priceUnit: pro.priceUnit,
    languages: pro.languages,
    eventTypes: pro.eventTypes,
    yearsExperience: pro.yearsExperience,
    publicEmail: pro.publicEmail,
    publicPhone: pro.publicPhone,
    website: pro.website,
    socialLinks: pro.socialLinks,
    verificationLevel: pro.verificationLevel,
    averageRating: pro.averageRating,
    reviewCount: pro.reviewCount,
    isDemo: pro.isDemo,
    acceptsChildrenServices: pro.acceptsChildrenServices,
    status: pro.status,
    publishedAt: pro.publishedAt?.toISOString() ?? null,
  };
}

async function loadProfessionalWithCategory(professionalId: string, executor: DbExecutor): Promise<{ pro: ProfessionalRow; cat: CategoryRow } | null> {
  const [row] = await executor
    .select({ pro: professionals, cat: professionalCategories })
    .from(professionals)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(eq(professionals.id, professionalId))
    .limit(1);
  return row ?? null;
}

function toSummary(v: VersionRow): VersionSummary {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    status: v.status,
    templateKey: v.templateKey,
    submittedAt: v.submittedAt?.toISOString() ?? null,
    reviewedAt: v.reviewedAt?.toISOString() ?? null,
    reviewNote: v.reviewNote,
    updatedAt: v.updatedAt.toISOString(),
  };
}

/** Content stored in an older schema is migrated on read; invalid content degrades to an empty page rather than crashing the public site. */
function readContent(v: Pick<VersionRow, "content" | "schemaVersion">): PageContent {
  const migrated = v.schemaVersion === SCHEMA_VERSION ? v.content : migrateContent(v.content, v.schemaVersion).content;
  const parsed = parseContent(migrated);
  return parsed.ok ? parsed.value : [];
}

function readTheme(v: Pick<VersionRow, "theme">): PageTheme {
  const parsed = parseTheme(v.theme);
  return parsed.ok ? parsed.value : {};
}

export async function buildRenderData(pro: ProfessionalRow, cat: CategoryRow, version: VersionRow, executor: DbExecutor = db): Promise<PageRenderData> {
  const content = readContent(version);
  const fileIds = new Set<string>();
  for (const b of content) {
    if (b.type === "hero" && b.props.imageFileId) fileIds.add(b.props.imageFileId);
    if (b.type === "about" && b.props.imageFileId) fileIds.add(b.props.imageFileId);
    if (b.type === "gallery") for (const img of b.props.images) fileIds.add(img.fileId);
  }
  const [services, reviews, availability, verifications, images] = await Promise.all([
    executor
      .select({
        id: professionalServices.id,
        name: professionalServices.name,
        description: professionalServices.description,
        priceCents: professionalServices.priceCents,
        priceUnit: professionalServices.priceUnit,
        durationMinutes: professionalServices.durationMinutes,
        minAge: professionalServices.minAge,
        maxAge: professionalServices.maxAge,
        capacity: professionalServices.capacity,
      })
      .from(professionalServices)
      .where(and(eq(professionalServices.professionalId, pro.id), eq(professionalServices.isActive, true)))
      .orderBy(professionalServices.sortOrder),
    executor
      .select({
        id: professionalReviews.id,
        authorName: users.name,
        rating: professionalReviews.rating,
        title: professionalReviews.title,
        body: professionalReviews.body,
        replyBody: professionalReviews.replyBody,
        createdAt: professionalReviews.createdAt,
      })
      .from(professionalReviews)
      .innerJoin(users, eq(users.id, professionalReviews.authorUserId))
      .where(and(eq(professionalReviews.professionalId, pro.id), eq(professionalReviews.status, "published")))
      .orderBy(desc(professionalReviews.createdAt))
      .limit(12),
    executor
      .select({ weekday: professionalAvailability.weekday, startMinute: professionalAvailability.startMinute, endMinute: professionalAvailability.endMinute })
      .from(professionalAvailability)
      .where(eq(professionalAvailability.professionalId, pro.id)),
    executor
      .select({ kind: professionalVerifications.kind, status: professionalVerifications.status, statement: professionalVerifications.statement, reviewedAt: professionalVerifications.reviewedAt })
      .from(professionalVerifications)
      .where(and(eq(professionalVerifications.professionalId, pro.id), eq(professionalVerifications.status, "verified"))),
    fileIds.size > 0
      ? executor
          .select({ fileId: files.id, width: files.width, height: files.height, sizeBytes: files.sizeBytes, mimeType: files.mimeType })
          .from(files)
          .where(and(inArray(files.id, [...fileIds]), eq(files.status, "clean")))
      : Promise.resolve([]),
  ]);
  return {
    professional: toSnapshot(pro, cat),
    templateKey: version.templateKey,
    theme: readTheme(version),
    content,
    services,
    reviews: reviews.map((r) => ({ ...r, authorName: firstNameAndInitial(r.authorName), createdAt: r.createdAt.toISOString() })),
    availability,
    verifications: verifications.map((v) => ({ ...v, reviewedAt: v.reviewedAt?.toISOString() ?? null })),
    images,
    seoTitle: version.seoTitle,
    seoDescription: version.seoDescription,
  };
}

/** Reviews are public but authors are not: "Lisa M." */
function firstNameAndInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts[1]?.[0];
  return last ? `${first} ${last.toUpperCase()}.` : first;
}

async function audit(executor: DbExecutor, input: { actorUserId: string | null; action: string; resourceType: string; resourceId: string; organizationId?: string | null; metadata?: Record<string, unknown>; reason?: string | null }) {
  await executor.insert(auditLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    organizationId: input.organizationId ?? null,
    metadata: input.metadata ?? {},
    reason: input.reason ?? null,
  });
}

// ── Creation ────────────────────────────────────────────────────────────────
/**
 * Creates the public profile + a first draft (v1) generated from the listing if
 * none exists. Safe to call repeatedly (idempotent).
 */
export async function ensurePublicProfile(professionalId: string, templateKey?: string, executor: DbExecutor = db): Promise<{ publicProfileId: string; draftVersionId: string }> {
  const loaded = await loadProfessionalWithCategory(professionalId, executor);
  if (!loaded) throw new NotFoundError();
  const { pro, cat } = loaded;

  const [existing] = await executor.select().from(publicProfiles).where(eq(publicProfiles.professionalId, professionalId)).limit(1);
  if (existing?.draftVersionId) return { publicProfileId: existing.id, draftVersionId: existing.draftVersionId };

  const chosen = templateKey && getTemplate(templateKey) ? templateKey : (cat.suggestedTemplates[0] ?? "minimal-ivoire");
  const template = getTemplateOrDefault(chosen);

  const profile =
    existing ??
    (
      await executor
        .insert(publicProfiles)
        .values({ professionalId, slug: pro.slug, isIndexable: false })
        .returning()
    )[0];
  if (!profile) throw new Error("failed to create public profile");

  const content = generateDefaultContent(toSnapshot(pro, cat), template.key);
  const [draft] = await executor
    .insert(profileVersions)
    .values({
      publicProfileId: profile.id,
      versionNumber: 1,
      status: "draft",
      templateKey: template.key,
      schemaVersion: SCHEMA_VERSION,
      theme: { palette: template.palettes[0]?.key },
      content,
      createdByUserId: pro.ownerUserId,
    })
    .returning();
  if (!draft) throw new Error("failed to create draft version");
  await executor.update(publicProfiles).set({ draftVersionId: draft.id }).where(eq(publicProfiles.id, profile.id));
  return { publicProfileId: profile.id, draftVersionId: draft.id };
}

// ── Public rendering ────────────────────────────────────────────────────────
export type PublishedPage = { publicProfileId: string; isIndexable: boolean; data: PageRenderData };

/** Null when the listing is not published or has no approved version: the route answers 404. */
export async function getPublishedPage(slug: string, executor: DbExecutor = db): Promise<PublishedPage | null> {
  const [row] = await executor
    .select({ profile: publicProfiles, pro: professionals, cat: professionalCategories })
    .from(publicProfiles)
    .innerJoin(professionals, eq(professionals.id, publicProfiles.professionalId))
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(eq(publicProfiles.slug, slug))
    .limit(1);
  if (!row || !row.profile.publishedVersionId || row.pro.status !== "published" || row.pro.deletedAt) return null;
  const [version] = await executor.select().from(profileVersions).where(eq(profileVersions.id, row.profile.publishedVersionId)).limit(1);
  if (!version || version.status !== "approved") return null;
  const data = await buildRenderData(row.pro, row.cat, version, executor);
  return { publicProfileId: row.profile.id, isIndexable: row.profile.isIndexable, data };
}

/** Fire-and-forget counter; callers must not await it on the request path. */
export async function incrementViewCount(publicProfileId: string, executor: DbExecutor = db): Promise<void> {
  await executor
    .update(publicProfiles)
    .set({ viewCount: sql`${publicProfiles.viewCount} + 1` })
    .where(eq(publicProfiles.id, publicProfileId));
}

/** Slugs eligible for the sitemap: approved version, published listing, indexable, not demo. */
export async function listIndexablePagePaths(executor: DbExecutor = db): Promise<Array<{ path: string; lastModified: Date }>> {
  const rows = await executor
    .select({ slug: publicProfiles.slug, updatedAt: publicProfiles.updatedAt, publishedAt: professionals.publishedAt })
    .from(publicProfiles)
    .innerJoin(professionals, eq(professionals.id, publicProfiles.professionalId))
    .where(and(eq(publicProfiles.isIndexable, true), eq(professionals.status, "published"), eq(professionals.isDemo, false), sql`${publicProfiles.publishedVersionId} is not null`));
  return rows.map((r) => ({ path: `/pro/${r.slug}`, lastModified: r.updatedAt }));
}

// ── Builder ─────────────────────────────────────────────────────────────────
export async function getTemplateAccess(actor: Actor, professionalId: string): Promise<TemplateAccess> {
  const [canUseAllTemplates, canCustomize, canUseSeoAssistant] = await Promise.all([
    hasFeature(actor.userId, "professional", "templates.all", professionalId),
    hasFeature(actor.userId, "professional", "customization.advanced", professionalId),
    hasFeature(actor.userId, "professional", "seo.assistant", professionalId),
  ]);
  return { canUseAllTemplates, canCustomize, canUseSeoAssistant };
}

async function loadProfileAndDraft(professionalId: string, executor: DbExecutor): Promise<{ profile: PublicProfileRow; draft: VersionRow }> {
  const { publicProfileId, draftVersionId } = await ensurePublicProfile(professionalId, undefined, executor);
  const [profile] = await executor.select().from(publicProfiles).where(eq(publicProfiles.id, publicProfileId)).limit(1);
  const [draft] = await executor.select().from(profileVersions).where(eq(profileVersions.id, draftVersionId)).limit(1);
  if (!profile || !draft) throw new NotFoundError();
  return { profile, draft };
}

export async function getDraft(actor: Actor, professionalId: string, executor: DbExecutor = db): Promise<DraftState> {
  const access = await requireProfessionalManage(actor, professionalId, executor);
  const loaded = await loadProfessionalWithCategory(professionalId, executor);
  if (!loaded) throw new NotFoundError();
  const { profile, draft } = await loadProfileAndDraft(professionalId, executor);
  const published = profile.publishedVersionId ? (await executor.select().from(profileVersions).where(eq(profileVersions.id, profile.publishedVersionId)).limit(1))[0] ?? null : null;
  const [renderData, templateAccess] = await Promise.all([buildRenderData(loaded.pro, loaded.cat, draft, executor), getTemplateAccess(actor, access.professionalId)]);
  const completeness = computeCompletenessPure({
    professional: renderData.professional,
    content: renderData.content,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    catalogServiceCount: renderData.services.length,
    publishedReviewCount: renderData.reviews.length,
  });
  return {
    publicProfileId: profile.id,
    slug: profile.slug,
    isIndexable: profile.isIndexable,
    viewCount: profile.viewCount,
    draft: { ...toSummary(draft), theme: renderData.theme, content: renderData.content, seoTitle: draft.seoTitle, seoDescription: draft.seoDescription },
    published: published ? toSummary(published) : null,
    pendingReview: draft.status === "submitted",
    renderData,
    access: templateAccess,
    completeness,
    suggestedTemplates: loaded.cat.suggestedTemplates,
  };
}

export type SaveDraftInput = {
  templateKey?: string;
  theme?: unknown;
  content?: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

/**
 * Autosave. Validates everything with the block schema. When the current draft
 * is no longer editable (submitted/approved/rejected/superseded), a new draft
 * version is cloned from it so the version under review or live stays intact.
 */
export async function saveDraft(actor: Actor, professionalId: string, input: SaveDraftInput, executor: DbExecutor = db): Promise<{ versionId: string; versionNumber: number; savedAt: string }> {
  await requireProfessionalManage(actor, professionalId, executor);
  const loaded = await loadProfessionalWithCategory(professionalId, executor);
  if (!loaded) throw new NotFoundError();

  const patch: Partial<typeof profileVersions.$inferInsert> = {};
  if (input.templateKey !== undefined) {
    const template = getTemplate(input.templateKey);
    if (!template) throw new ValidationError("Template inconnu.");
    if (!template.isFree) {
      const allowed = await hasFeature(actor.userId, "professional", "templates.all", professionalId);
      if (!allowed) throw new ValidationError("Ce template fait partie de la bibliothèque Premium.");
    }
    patch.templateKey = template.key;
  }
  if (input.theme !== undefined) {
    const theme = parseTheme(input.theme);
    if (!theme.ok) throw new ValidationError("Thème invalide.", { issues: theme.issues });
    if (theme.value.accent || theme.value.fontPairing || theme.value.radius) {
      const allowed = await hasFeature(actor.userId, "professional", "customization.advanced", professionalId);
      if (!allowed) throw new ValidationError("La personnalisation avancée fait partie de l'offre Premium.");
    }
    patch.theme = theme.value;
  }
  if (input.content !== undefined) {
    const content = parseContent(input.content);
    if (!content.ok) throw new ValidationError("Contenu de page invalide.", { issues: content.issues });
    patch.content = content.value;
    patch.schemaVersion = SCHEMA_VERSION;
  }
  if (input.seoTitle !== undefined || input.seoDescription !== undefined) {
    const seo = seoFieldsSchema.safeParse({ seoTitle: input.seoTitle, seoDescription: input.seoDescription });
    if (!seo.success) throw new ValidationError("Champs SEO invalides.");
    if (input.seoTitle !== undefined) patch.seoTitle = seo.data.seoTitle ?? null;
    if (input.seoDescription !== undefined) patch.seoDescription = seo.data.seoDescription ?? null;
  }

  const { profile, draft } = await loadProfileAndDraft(professionalId, executor);

  // Switching template: keep what was written, append the new template's missing default sections (hidden).
  if (patch.templateKey && patch.templateKey !== draft.templateKey) {
    const base = (patch.content as PageContent | undefined) ?? readContent(draft);
    patch.content = mergeContentForTemplate(base, patch.templateKey, toSnapshot(loaded.pro, loaded.cat));
    patch.schemaVersion = SCHEMA_VERSION;
    const newTemplate = getTemplateOrDefault(patch.templateKey);
    const theme = (patch.theme as PageTheme | undefined) ?? readTheme(draft);
    if (!newTemplate.palettes.some((pl) => pl.key === theme.palette)) patch.theme = { ...theme, palette: newTemplate.palettes[0]?.key };
  }

  if (draft.status === "draft") {
    const [updated] = await executor
      .update(profileVersions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(profileVersions.id, draft.id))
      .returning({ id: profileVersions.id, versionNumber: profileVersions.versionNumber, updatedAt: profileVersions.updatedAt });
    if (!updated) throw new NotFoundError();
    return { versionId: updated.id, versionNumber: updated.versionNumber, savedAt: updated.updatedAt.toISOString() };
  }

  // Draft pointer is on a frozen version: clone it into a new editable version.
  const [{ max }] = (await executor.select({ max: sql<number>`coalesce(max(${profileVersions.versionNumber}), 0)` }).from(profileVersions).where(eq(profileVersions.publicProfileId, profile.id))) as [{ max: number }];
  const [created] = await executor
    .insert(profileVersions)
    .values({
      publicProfileId: profile.id,
      versionNumber: Number(max) + 1,
      status: "draft",
      templateKey: patch.templateKey ?? draft.templateKey,
      schemaVersion: SCHEMA_VERSION,
      theme: (patch.theme as PageTheme | undefined) ?? readTheme(draft),
      content: (patch.content as PageContent | undefined) ?? readContent(draft),
      seoTitle: patch.seoTitle !== undefined ? patch.seoTitle : draft.seoTitle,
      seoDescription: patch.seoDescription !== undefined ? patch.seoDescription : draft.seoDescription,
      createdByUserId: actor.userId,
    })
    .returning({ id: profileVersions.id, versionNumber: profileVersions.versionNumber, updatedAt: profileVersions.updatedAt });
  if (!created) throw new Error("failed to create draft version");
  await executor.update(publicProfiles).set({ draftVersionId: created.id }).where(eq(publicProfiles.id, profile.id));
  return { versionId: created.id, versionNumber: created.versionNumber, savedAt: created.updatedAt.toISOString() };
}

export async function submitForReview(actor: Actor, professionalId: string, executor: DbExecutor = db): Promise<{ versionId: string; caseId: string }> {
  const access = await requireProfessionalManage(actor, professionalId, executor);
  const { profile, draft } = await loadProfileAndDraft(professionalId, executor);
  if (draft.status === "submitted") throw new ConflictError("Cette version est déjà en cours de modération.");
  if (draft.status !== "draft") throw new ConflictError("Modifiez la page avant de la soumettre à nouveau.");
  const content = pageContentSchema.safeParse(draft.content);
  if (!content.success) throw new ValidationError("Le contenu de la page est invalide.");
  const visibleBlocks = content.data.filter((b) => !b.hidden);
  if (visibleBlocks.length === 0) throw new ValidationError("Ajoutez au moins une section visible avant de soumettre.");
  if (!visibleBlocks.some((b) => b.type === "hero")) throw new ValidationError("La page doit comporter une section En-tête visible.");

  const now = new Date();
  await executor.update(profileVersions).set({ status: "submitted", submittedAt: now, reviewNote: null, updatedAt: now }).where(eq(profileVersions.id, draft.id));
  const { caseId } = await openModerationCase(
    {
      kind: profile.publishedVersionId ? "profile_update_review" : "profile_review",
      resourceType: "profile_version",
      resourceId: draft.id,
      professionalId,
      openedByUserId: actor.userId,
      summary: `Version ${draft.versionNumber} de la page publique (template ${draft.templateKey}).`,
    },
    executor,
  );
  // First submission moves the listing itself into review; later ones leave the live listing untouched.
  if (!profile.publishedVersionId) {
    await executor.update(professionals).set({ status: "pending_review", updatedAt: now }).where(and(eq(professionals.id, professionalId), inArray(professionals.status, ["draft", "changes_requested", "rejected"])));
  }
  await audit(executor, {
    actorUserId: actor.userId,
    action: "profile_version.submitted",
    resourceType: "profile_version",
    resourceId: draft.id,
    organizationId: access.organizationId,
    metadata: { professionalId, versionNumber: draft.versionNumber, caseId },
  });
  return { versionId: draft.id, caseId };
}

// ── Moderation decisions ────────────────────────────────────────────────────
async function loadVersionForDecision(versionId: string, executor: DbExecutor) {
  const [row] = await executor
    .select({ version: profileVersions, profile: publicProfiles, pro: professionals })
    .from(profileVersions)
    .innerJoin(publicProfiles, eq(publicProfiles.id, profileVersions.publicProfileId))
    .innerJoin(professionals, eq(professionals.id, publicProfiles.professionalId))
    .where(eq(profileVersions.id, versionId))
    .limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

export async function approveVersion(moderator: Actor, versionId: string, note?: string, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(moderator, "moderation.decide");
  const { version, profile, pro } = await loadVersionForDecision(versionId, executor);
  if (version.status !== "submitted") throw new ConflictError("Seule une version soumise peut être approuvée.");
  const now = new Date();
  const run = async (tx: DbExecutor) => {
    if (profile.publishedVersionId && profile.publishedVersionId !== versionId) {
      await tx.update(profileVersions).set({ status: "superseded", updatedAt: now }).where(eq(profileVersions.id, profile.publishedVersionId));
    }
    await tx.update(profileVersions).set({ status: "approved", reviewedAt: now, reviewedByUserId: moderator.userId, reviewNote: note ?? null, updatedAt: now }).where(eq(profileVersions.id, versionId));
    await tx
      .update(publicProfiles)
      .set({ publishedVersionId: versionId, isIndexable: !pro.isDemo, slug: pro.slug, updatedAt: now })
      .where(eq(publicProfiles.id, profile.id));
    await tx
      .update(professionals)
      .set({ status: "published", publishedAt: pro.publishedAt ?? now, statusReason: null, updatedAt: now })
      .where(eq(professionals.id, pro.id));
    await audit(tx, {
      actorUserId: moderator.userId,
      action: "profile_version.approved",
      resourceType: "profile_version",
      resourceId: versionId,
      organizationId: pro.organizationId,
      metadata: { professionalId: pro.id, versionNumber: version.versionNumber, previousVersionId: profile.publishedVersionId },
      reason: note ?? null,
    });
  };
  if ("transaction" in executor && executor === db) await db.transaction(run);
  else await run(executor);
  await notify(
    { userId: pro.ownerUserId, type: "profile_approved", title: "Votre page publique est en ligne", body: `La version ${version.versionNumber} de votre page a été approuvée.`, href: `/pro/${pro.slug}`, dedupeKey: `profile_approved:${versionId}` },
    executor,
  ).catch(() => undefined);
}

export async function rejectVersion(moderator: Actor, versionId: string, note: string, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(moderator, "moderation.decide");
  if (!note || note.trim().length < 3) throw new ValidationError("Un motif est obligatoire pour refuser une version.");
  const { version, profile, pro } = await loadVersionForDecision(versionId, executor);
  if (version.status !== "submitted") throw new ConflictError("Seule une version soumise peut être refusée.");
  const now = new Date();
  await executor.update(profileVersions).set({ status: "rejected", reviewedAt: now, reviewedByUserId: moderator.userId, reviewNote: note, updatedAt: now }).where(eq(profileVersions.id, versionId));
  if (!profile.publishedVersionId) {
    await executor.update(professionals).set({ status: "rejected", statusReason: note, updatedAt: now }).where(eq(professionals.id, pro.id));
  }
  await audit(executor, { actorUserId: moderator.userId, action: "profile_version.rejected", resourceType: "profile_version", resourceId: versionId, organizationId: pro.organizationId, metadata: { professionalId: pro.id, versionNumber: version.versionNumber }, reason: note });
  await notify({ userId: pro.ownerUserId, type: "profile_rejected", title: "Votre page publique n'a pas été approuvée", body: note, href: `/app/pro/${pro.id}/page`, dedupeKey: `profile_rejected:${versionId}` }, executor).catch(() => undefined);
}

export async function requestChanges(moderator: Actor, versionId: string, note: string, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(moderator, "moderation.decide");
  if (!note || note.trim().length < 3) throw new ValidationError("Précisez les modifications attendues.");
  const { version, profile, pro } = await loadVersionForDecision(versionId, executor);
  if (version.status !== "submitted") throw new ConflictError("Seule une version soumise peut faire l'objet d'une demande de modification.");
  const now = new Date();
  // Back to draft: the professional edits the same version and resubmits.
  await executor.update(profileVersions).set({ status: "draft", reviewedAt: now, reviewedByUserId: moderator.userId, reviewNote: note, updatedAt: now }).where(eq(profileVersions.id, versionId));
  if (!profile.publishedVersionId) {
    await executor.update(professionals).set({ status: "changes_requested", statusReason: note, updatedAt: now }).where(eq(professionals.id, pro.id));
  }
  await audit(executor, { actorUserId: moderator.userId, action: "profile_version.changes_requested", resourceType: "profile_version", resourceId: versionId, organizationId: pro.organizationId, metadata: { professionalId: pro.id, versionNumber: version.versionNumber }, reason: note });
  await notify({ userId: pro.ownerUserId, type: "changes_requested", title: "Des modifications sont demandées sur votre page", body: note, href: `/app/pro/${pro.id}/page`, dedupeKey: `changes_requested:${versionId}` }, executor).catch(() => undefined);
}

// ── Completeness ────────────────────────────────────────────────────────────
/** Explainable 0-100 score for a (listing, version) pair, loading the catalogue/review counts it needs. */
export async function computeCompleteness(professional: Pick<ProfessionalRow, "id" | "city" | "publicEmail" | "publicPhone" | "verificationLevel" | "reviewCount">, version: Pick<VersionRow, "content" | "schemaVersion" | "seoTitle" | "seoDescription">, executor: DbExecutor = db): Promise<Completeness> {
  const [[svc], [rev]] = await Promise.all([
    executor.select({ n: sql<number>`count(*)` }).from(professionalServices).where(and(eq(professionalServices.professionalId, professional.id), eq(professionalServices.isActive, true))),
    executor.select({ n: sql<number>`count(*)` }).from(professionalReviews).where(and(eq(professionalReviews.professionalId, professional.id), eq(professionalReviews.status, "published"))),
  ]);
  return computeCompletenessPure({
    professional,
    content: readContent(version),
    seoTitle: version.seoTitle,
    seoDescription: version.seoDescription,
    catalogServiceCount: Number(svc?.n ?? 0),
    publishedReviewCount: Number(rev?.n ?? 0),
  });
}

/** For the admin review screen: a version's render data regardless of status (caller checks permission). */
export async function getVersionRenderData(versionId: string, executor: DbExecutor = db): Promise<PageRenderData | null> {
  const [row] = await executor
    .select({ version: profileVersions, pro: professionals, cat: professionalCategories })
    .from(profileVersions)
    .innerJoin(publicProfiles, eq(publicProfiles.id, profileVersions.publicProfileId))
    .innerJoin(professionals, eq(professionals.id, publicProfiles.professionalId))
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(eq(profileVersions.id, versionId))
    .limit(1);
  if (!row) return null;
  return buildRenderData(row.pro, row.cat, row.version, executor);
}

export { isFreeTemplate };
