import { cache } from "react";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import {
  eventMembers,
  events,
  organizationMembers,
  organizations,
  professionalAvailability,
  professionalCategories,
  professionalCategoryAssignments,
  professionalServices,
  professionalVerifications,
  professionals,
} from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission, requireProfessionalManage } from "@/modules/authorization";
import { openModerationCase } from "@/modules/moderation/application/moderation-service";
import { notify } from "@/modules/notifications/application/notification-service";
import { computeCompleteness, SUBMISSION_MIN_SCORE, type CompletenessResult } from "@/modules/professionals/domain/completeness";
import { resolveLocation } from "@/modules/professionals/domain/geo";
import { type ListingEditInput, type Step1Input, type Step2Input, type Step4Input } from "@/modules/professionals/domain/listing-schema";
import { resolveUniqueSlug } from "@/modules/professionals/domain/slug";
import { canTransition, changedMajorFields, type ProfessionalStatus } from "@/modules/professionals/domain/status";
import { buildTradeSchema } from "@/modules/professionals/domain/trade-forms";
import { computeVerificationLevel, type VerificationKind, type VerificationStatus } from "@/modules/professionals/domain/verification";
import { sirenFromSiret } from "@/modules/professionals/domain/siret";
import { audit } from "./audit";
import { ensurePublicProfileIfAvailable } from "./page-bridge";

export type ProfessionalRow = typeof professionals.$inferSelect;
export type CategoryRow = typeof professionalCategories.$inferSelect;

export type ManagedListing = {
  listing: ProfessionalRow;
  category: CategoryRow;
  secondaryCategories: CategoryRow[];
  role: "owner" | "org_admin" | "org_manager";
};

/** Listings the actor may manage: owned, or through an organisation membership (admin/manager). */
export async function listManagedListings(actor: Actor, executor: DbExecutor = db) {
  const orgIds = (
    await executor
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, actor.userId), inArray(organizationMembers.role, ["owner", "admin", "manager"])))
  ).map((r) => r.organizationId);

  const where = orgIds.length ? or(eq(professionals.ownerUserId, actor.userId), inArray(professionals.organizationId, orgIds)) : eq(professionals.ownerUserId, actor.userId);
  return executor
    .select({
      id: professionals.id,
      slug: professionals.slug,
      displayName: professionals.displayName,
      status: professionals.status,
      city: professionals.city,
      completenessScore: professionals.completenessScore,
      verificationLevel: professionals.verificationLevel,
      updatedAt: professionals.updatedAt,
      categoryName: professionalCategories.name,
      categoryIcon: professionalCategories.icon,
      ownerUserId: professionals.ownerUserId,
    })
    .from(professionals)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(and(where, isNull(professionals.deletedAt)))
    .orderBy(desc(professionals.updatedAt));
}

async function loadManaged(actor: Actor, professionalId: string, executor: DbExecutor): Promise<ManagedListing> {
  const access = await requireProfessionalManage(actor, professionalId, executor);
  const [row] = await executor
    .select()
    .from(professionals)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(eq(professionals.id, professionalId))
    .limit(1);
  if (!row) throw new NotFoundError();
  const secondary = await executor
    .select({ c: professionalCategories })
    .from(professionalCategoryAssignments)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionalCategoryAssignments.categoryId))
    .where(eq(professionalCategoryAssignments.professionalId, professionalId))
    .orderBy(asc(professionalCategories.sortOrder));
  return {
    listing: row.professionals,
    category: row.professional_categories,
    secondaryCategories: secondary.map((s) => s.c),
    role: access.role === "org_member" ? "org_manager" : access.role,
  };
}

/** Request-scoped cache: the workspace layout and its pages share one lookup. */
export const getManagedListing = cache(async (actor: Actor, professionalId: string): Promise<ManagedListing> => loadManaged(actor, professionalId, db));

export async function listActiveCategories(executor: DbExecutor = db): Promise<CategoryRow[]> {
  return executor.select().from(professionalCategories).where(eq(professionalCategories.isActive, true)).orderBy(asc(professionalCategories.sortOrder), asc(professionalCategories.name));
}

// ── Derived fields ──────────────────────────────────────────────────────────
export async function recomputeDerived(professionalId: string, executor: DbExecutor = db): Promise<{ completeness: CompletenessResult; verificationLevel: number }> {
  const [p] = await executor.select().from(professionals).where(eq(professionals.id, professionalId)).limit(1);
  if (!p) throw new NotFoundError();
  const [svc] = await executor.select({ n: sql<number>`count(*)::int` }).from(professionalServices).where(and(eq(professionalServices.professionalId, professionalId), eq(professionalServices.isActive, true)));
  const [avail] = await executor.select({ n: sql<number>`count(*)::int` }).from(professionalAvailability).where(eq(professionalAvailability.professionalId, professionalId));
  const verifs = await executor.select({ kind: professionalVerifications.kind, status: professionalVerifications.status, validUntil: professionalVerifications.validUntil }).from(professionalVerifications).where(eq(professionalVerifications.professionalId, professionalId));
  const [secondary] = await executor.select({ n: sql<number>`count(*)::int` }).from(professionalCategoryAssignments).where(eq(professionalCategoryAssignments.professionalId, professionalId));

  const completeness = computeCompleteness({
    displayName: p.displayName,
    tagline: p.tagline,
    description: p.description,
    city: p.city,
    postalCode: p.postalCode,
    priceFromCents: p.priceFromCents,
    languages: p.languages,
    eventTypes: p.eventTypes,
    yearsExperience: p.yearsExperience,
    publicEmail: p.publicEmail,
    publicPhone: p.publicPhone,
    website: p.website,
    tradeDetails: p.tradeDetails,
    servicesCount: svc?.n ?? 0,
    availabilityCount: avail?.n ?? 0,
    verifiedCount: verifs.filter((v) => v.status === "verified").length,
    secondaryCategoriesCount: secondary?.n ?? 0,
  });
  const verificationLevel = computeVerificationLevel(verifs.map((v) => ({ kind: v.kind as VerificationKind, status: v.status as VerificationStatus, validUntil: v.validUntil })));
  await executor.update(professionals).set({ completenessScore: completeness.score, verificationLevel }).where(eq(professionals.id, professionalId));
  return { completeness, verificationLevel };
}

// ── Onboarding ──────────────────────────────────────────────────────────────
async function assertCategory(id: string, executor: DbExecutor): Promise<CategoryRow> {
  const [c] = await executor.select().from(professionalCategories).where(and(eq(professionalCategories.id, id), eq(professionalCategories.isActive, true))).limit(1);
  if (!c) throw new ValidationError("Catégorie inconnue.");
  return c;
}

async function replaceSecondaryCategories(professionalId: string, primaryId: string, ids: string[], executor: DbExecutor): Promise<void> {
  await executor.delete(professionalCategoryAssignments).where(eq(professionalCategoryAssignments.professionalId, professionalId));
  const unique = [...new Set(ids)].filter((id) => id !== primaryId);
  if (!unique.length) return;
  const valid = await executor.select({ id: professionalCategories.id }).from(professionalCategories).where(and(inArray(professionalCategories.id, unique), eq(professionalCategories.isActive, true)));
  if (valid.length) await executor.insert(professionalCategoryAssignments).values(valid.map((v) => ({ professionalId, categoryId: v.id })));
}

/** Step 1 creates the draft right away so progress is never lost. */
export async function createDraft(actor: Actor, input: Step1Input, executor: DbExecutor = db): Promise<{ id: string }> {
  const category = await assertCategory(input.primaryCategoryId, executor);
  const placeholder = `brouillon-${crypto.randomUUID().slice(0, 8)}`;
  const [row] = await executor
    .insert(professionals)
    .values({
      ownerUserId: actor.userId,
      slug: placeholder,
      displayName: "",
      primaryCategoryId: category.id,
      status: "draft",
      acceptsChildrenServices: category.isChildcare,
      isDemo: actor.isDemo,
    })
    .returning({ id: professionals.id });
  if (!row) throw new Error("insert failed");
  await replaceSecondaryCategories(row.id, category.id, input.secondaryCategoryIds, executor);
  await audit({ actorUserId: actor.userId, action: "professional.created", resourceType: "professional", resourceId: row.id, metadata: { categorySlug: category.slug } }, executor);
  return { id: row.id };
}

export async function saveStep1(actor: Actor, professionalId: string, input: Step1Input, executor: DbExecutor = db): Promise<void> {
  const { listing } = await loadManaged(actor, professionalId, executor);
  const category = await assertCategory(input.primaryCategoryId, executor);
  await executor
    .update(professionals)
    .set({ primaryCategoryId: category.id, acceptsChildrenServices: listing.acceptsChildrenServices || category.isChildcare })
    .where(eq(professionals.id, professionalId));
  await replaceSecondaryCategories(professionalId, category.id, input.secondaryCategoryIds, executor);
}

async function ensureSlug(professionalId: string, displayName: string, current: string, executor: DbExecutor): Promise<string> {
  if (!current.startsWith("brouillon-")) return current;
  const taken = new Set((await executor.select({ slug: professionals.slug }).from(professionals)).map((r) => r.slug));
  taken.delete(current);
  return resolveUniqueSlug(displayName, (c) => taken.has(c));
}

/** Creates (or updates) the organisation when the listing is operated by a company/association. */
async function upsertOrganization(actor: Actor, listing: ProfessionalRow, input: Step2Input, executor: DbExecutor): Promise<string | null> {
  if (input.organizationType === "sole_trader" && !input.siret) return listing.organizationId;
  const siret = input.siret && input.siret.length === 14 ? input.siret : null;
  const siren = input.siret ? (input.siret.length === 14 ? sirenFromSiret(input.siret) : input.siret) : null;
  if (listing.organizationId) {
    await executor
      .update(organizations)
      .set({ name: input.displayName, type: input.organizationType, siren, siret, city: input.city, postalCode: input.postalCode })
      .where(eq(organizations.id, listing.organizationId));
    return listing.organizationId;
  }
  const taken = new Set((await executor.select({ slug: organizations.slug }).from(organizations)).map((r) => r.slug));
  const slug = resolveUniqueSlug(input.displayName, (c) => taken.has(c));
  const [org] = await executor
    .insert(organizations)
    .values({ name: input.displayName, slug, type: input.organizationType, siren, siret, city: input.city, postalCode: input.postalCode, ownerUserId: actor.userId })
    .returning({ id: organizations.id });
  if (!org) throw new Error("organization insert failed");
  await executor.insert(organizationMembers).values({ organizationId: org.id, userId: actor.userId, role: "owner", acceptedAt: new Date() }).onConflictDoNothing();
  return org.id;
}

export async function saveStep2(actor: Actor, professionalId: string, input: Step2Input, executor: DbExecutor = db): Promise<void> {
  const { listing } = await loadManaged(actor, professionalId, executor);
  const loc = resolveLocation(input.city, input.postalCode);
  if (!loc.department) throw new ValidationError("Code postal inconnu.");
  const slug = await ensureSlug(professionalId, input.displayName, listing.slug, executor);
  const organizationId = await upsertOrganization(actor, listing, input, executor);
  await executor
    .update(professionals)
    .set({
      displayName: input.displayName,
      slug,
      organizationId,
      city: input.city,
      postalCode: input.postalCode,
      department: loc.department.code,
      region: loc.region,
      latitude: loc.latitude,
      longitude: loc.longitude,
      interventionRadiusKm: input.interventionRadiusKm,
    })
    .where(eq(professionals.id, professionalId));
  await recomputeDerived(professionalId, executor);
}

export function validateTradeDetails(formSchemaKey: string, raw: Record<string, unknown>): Record<string, unknown> {
  const parsed = buildTradeSchema(formSchemaKey).safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    throw new ValidationError("Certaines réponses sont incomplètes.", { fieldErrors });
  }
  return parsed.data as Record<string, unknown>;
}

export async function saveStep3(actor: Actor, professionalId: string, raw: Record<string, unknown>, executor: DbExecutor = db): Promise<void> {
  const { listing, category } = await loadManaged(actor, professionalId, executor);
  const details = validateTradeDetails(category.formSchemaKey, raw);
  // Keep internal keys (template choice) when re-saving the trade form.
  const kept = Object.fromEntries(Object.entries(listing.tradeDetails).filter(([k]) => k.startsWith("__")));
  await executor.update(professionals).set({ tradeDetails: { ...kept, ...details } }).where(eq(professionals.id, professionalId));
  await recomputeDerived(professionalId, executor);
}

function step4Values(input: Step4Input) {
  const social: Record<string, string> = {};
  if (input.instagram) social.instagram = input.instagram;
  if (input.facebook) social.facebook = input.facebook;
  return {
    tagline: input.tagline || null,
    description: input.description || null,
    priceFromCents: input.priceFromCents ?? null,
    priceToCents: input.priceToCents ?? null,
    priceUnit: input.priceUnit || null,
    languages: input.languages,
    eventTypes: input.eventTypes,
    yearsExperience: input.yearsExperience ?? null,
    publicEmail: input.publicEmail || null,
    publicPhone: input.publicPhone || null,
    website: input.website || null,
    socialLinks: social,
    acceptsChildrenServices: input.acceptsChildrenServices,
  };
}

export async function saveStep4(actor: Actor, professionalId: string, input: Step4Input, executor: DbExecutor = db): Promise<void> {
  await loadManaged(actor, professionalId, executor);
  if (input.priceFromCents != null && input.priceToCents != null && input.priceToCents < input.priceFromCents) throw new ValidationError("Le tarif maximal doit être supérieur au tarif minimal.");
  await executor.update(professionals).set(step4Values(input)).where(eq(professionals.id, professionalId));
  await recomputeDerived(professionalId, executor);
}

export async function saveTemplateChoice(actor: Actor, professionalId: string, templateKey: string, executor: DbExecutor = db): Promise<void> {
  const { listing, category } = await loadManaged(actor, professionalId, executor);
  const allowed = category.suggestedTemplates.length ? category.suggestedTemplates : [templateKey];
  if (!allowed.includes(templateKey)) throw new ValidationError("Modèle non proposé pour ce métier.");
  await executor.update(professionals).set({ tradeDetails: { ...listing.tradeDetails, __templateKey: templateKey } }).where(eq(professionals.id, professionalId));
  await ensurePublicProfileIfAvailable(professionalId, templateKey);
}

/** Owner submits the listing: draft/changes_requested/rejected → pending_review, opens a moderation case. */
export async function submitForReview(actor: Actor, professionalId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { listing, category } = await loadManaged(actor, professionalId, tx);
    if (!canTransition(listing.status, "pending_review", "owner")) throw new ConflictError("Cette fiche ne peut pas être soumise dans son état actuel.");
    if (!listing.displayName || !listing.city) throw new ValidationError("Renseignez au moins le nom commercial et la ville avant de soumettre.");
    const { completeness } = await recomputeDerived(professionalId, tx);
    if (completeness.score < SUBMISSION_MIN_SCORE) throw new ValidationError(`Complétez votre fiche (au moins ${SUBMISSION_MIN_SCORE} % — actuellement ${completeness.score} %).`);
    await tx.update(professionals).set({ status: "pending_review", statusReason: null }).where(eq(professionals.id, professionalId));
    await tx
      .insert(professionalVerifications)
      .values({ professionalId, kind: "identity_declared", status: "verified", statement: "Identité et coordonnées renseignées par le professionnel lors de l'inscription.", reviewedAt: new Date() })
      .onConflictDoNothing();
    await recomputeDerived(professionalId, tx);
    await openModerationCase({ kind: "profile_review", resourceType: "professional", resourceId: professionalId, professionalId, openedByUserId: actor.userId, summary: `Fiche « ${listing.displayName} » (${category.name}) soumise pour validation.` }, tx);
    await audit({ actorUserId: actor.userId, action: "professional.submitted", resourceType: "professional", resourceId: professionalId, metadata: { from: listing.status, to: "pending_review" } }, tx);
    await notify({ userId: actor.userId, type: "system", title: "Fiche envoyée à la validation", body: "Notre équipe relit votre fiche. Vous serez prévenu dès la publication.", href: `/app/pro/${professionalId}`, dedupeKey: `pro:${professionalId}:submitted` }, tx);
  });
}

/**
 * Full editor. On a published listing, a change of a major field keeps the
 * listing online but opens a `profile_update_review` case; other changes apply
 * directly.
 */
export async function updateListing(actor: Actor, professionalId: string, input: ListingEditInput, rawTradeDetails: Record<string, unknown> | null): Promise<{ reviewOpened: boolean }> {
  return db.transaction(async (tx) => {
    const { listing } = await loadManaged(actor, professionalId, tx);
    const category = await assertCategory(input.primaryCategoryId, tx);
    const loc = resolveLocation(input.city, input.postalCode);
    if (!loc.department) throw new ValidationError("Code postal inconnu.");
    if (input.priceFromCents != null && input.priceToCents != null && input.priceToCents < input.priceFromCents) throw new ValidationError("Le tarif maximal doit être supérieur au tarif minimal.");
    const slug = await ensureSlug(professionalId, input.displayName, listing.slug, tx);
    const organizationId = await upsertOrganization(actor, listing, input, tx);
    const kept = Object.fromEntries(Object.entries(listing.tradeDetails).filter(([k]) => k.startsWith("__")));
    const tradeDetails = rawTradeDetails ? { ...kept, ...validateTradeDetails(category.formSchemaKey, rawTradeDetails) } : listing.tradeDetails;

    const major = changedMajorFields(
      { displayName: listing.displayName, primaryCategoryId: listing.primaryCategoryId, description: listing.description, tagline: listing.tagline },
      { displayName: input.displayName, primaryCategoryId: category.id, description: input.description || null, tagline: input.tagline || null },
    );
    await tx
      .update(professionals)
      .set({
        displayName: input.displayName,
        slug,
        organizationId,
        primaryCategoryId: category.id,
        city: input.city,
        postalCode: input.postalCode,
        department: loc.department.code,
        region: loc.region,
        latitude: loc.latitude,
        longitude: loc.longitude,
        interventionRadiusKm: input.interventionRadiusKm,
        tradeDetails,
        ...step4Values(input),
      })
      .where(eq(professionals.id, professionalId));
    await replaceSecondaryCategories(professionalId, category.id, input.secondaryCategoryIds, tx);
    await recomputeDerived(professionalId, tx);

    let reviewOpened = false;
    if (listing.status === "published" && major.length > 0) {
      await openModerationCase({ kind: "profile_update_review", resourceType: "professional", resourceId: professionalId, professionalId, openedByUserId: actor.userId, summary: `Modification de champs majeurs sur une fiche publiée : ${major.join(", ")}.` }, tx);
      await audit({ actorUserId: actor.userId, action: "professional.major_update", resourceType: "professional", resourceId: professionalId, metadata: { fields: major } }, tx);
      reviewOpened = true;
    }
    return { reviewOpened };
  });
}

/** Soft delete: deletedAt + status archived. The slug stays reserved. */
export async function archiveListing(actor: Actor, professionalId: string, reason?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { listing } = await loadManaged(actor, professionalId, tx);
    if (!canTransition(listing.status, "archived", "owner")) throw new ConflictError("Fiche déjà archivée.");
    await tx.update(professionals).set({ status: "archived", deletedAt: new Date(), statusReason: reason ?? null }).where(eq(professionals.id, professionalId));
    await audit({ actorUserId: actor.userId, action: "professional.archived", resourceType: "professional", resourceId: professionalId, organizationId: listing.organizationId, metadata: { from: listing.status }, reason }, tx);
  });
}

/** Moderator transition (approve/publish/suspend/request changes/reject). The admin module calls this from its decision workflow. */
export async function setListingStatusAsModerator(actor: Actor, professionalId: string, to: ProfessionalStatus, reason?: string | null, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "moderation.decide");
  const [listing] = await executor.select().from(professionals).where(and(eq(professionals.id, professionalId), isNull(professionals.deletedAt))).limit(1);
  if (!listing) throw new NotFoundError();
  if (!canTransition(listing.status, to, "moderator")) throw new ConflictError(`Transition ${listing.status} → ${to} impossible.`);
  await executor
    .update(professionals)
    .set({ status: to, statusReason: reason ?? null, publishedAt: to === "published" ? (listing.publishedAt ?? new Date()) : listing.publishedAt })
    .where(eq(professionals.id, professionalId));
  await audit({ actorUserId: actor.userId, action: `professional.${to}`, resourceType: "professional", resourceId: professionalId, metadata: { from: listing.status, to }, reason: reason ?? null }, executor);
  const titles: Partial<Record<ProfessionalStatus, { type: "profile_approved" | "changes_requested" | "profile_rejected" | "system"; title: string }>> = {
    published: { type: "profile_approved", title: "Votre fiche est publiée" },
    approved: { type: "profile_approved", title: "Votre fiche est approuvée" },
    changes_requested: { type: "changes_requested", title: "Des modifications sont demandées sur votre fiche" },
    rejected: { type: "profile_rejected", title: "Votre fiche n'a pas été acceptée" },
    suspended: { type: "system", title: "Votre fiche est suspendue" },
  };
  const n = titles[to];
  if (n) await notify({ userId: listing.ownerUserId, type: n.type, title: n.title, body: reason ?? undefined, href: `/app/pro/${professionalId}` }, executor);
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export async function getDashboardData(actor: Actor, professionalId: string) {
  const managed = await getManagedListing(actor, professionalId);
  const { completeness } = await recomputeDerived(professionalId);
  const upcoming = await db
    .select({ id: events.id, name: events.name, eventDate: events.eventDate, city: events.city, role: eventMembers.role, status: events.status })
    .from(eventMembers)
    .innerJoin(events, eq(events.id, eventMembers.eventId))
    .where(and(eq(eventMembers.professionalId, professionalId), eq(eventMembers.status, "active"), isNull(events.deletedAt), sql`${events.eventDate} >= current_date`))
    .orderBy(asc(events.eventDate))
    .limit(5);
  return { ...managed, completeness, upcoming };
}
