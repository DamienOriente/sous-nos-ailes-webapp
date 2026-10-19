import { asc, count, eq, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalCategories, professionalToolActivations, professionals, toolDefinitions } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { requireGlobalPermission } from "@/modules/authorization";
import { FEATURES } from "@/modules/billing/domain/plans";
import { recordAudit } from "@/modules/admin/application/audit";

/**
 * Categories (trades) and tool catalogue. A category used by listings is never
 * deleted: deactivating hides it from onboarding and the directory filters.
 */
export type CategoryInput = { name: string; slug?: string; group: string; icon: string; description?: string | null; isChildcare: boolean; formSchemaKey: string; defaultTools: string[]; suggestedTemplates: string[]; sortOrder: number; isActive: boolean };

export const FORM_SCHEMA_KEYS = ["childcare", "animation", "venue", "caterer", "photo", "dj", "planner", "generic"] as const;

function assertCategory(input: CategoryInput): void {
  if (input.name.trim().length < 2) throw new ValidationError("Nom trop court.");
  if (!input.group.trim()) throw new ValidationError("Groupe requis.");
  if (!(FORM_SCHEMA_KEYS as readonly string[]).includes(input.formSchemaKey)) throw new ValidationError("Formulaire inconnu.");
  if (!/^[a-z0-9-]+$/.test(input.icon)) throw new ValidationError("Icône invalide (nom lucide en kebab-case).");
}

export async function listCategoriesAdmin(actor: Actor) {
  requireGlobalPermission(actor, "admin.categories.manage");
  const usage = await db.select({ categoryId: professionals.primaryCategoryId, n: count() }).from(professionals).groupBy(professionals.primaryCategoryId);
  const rows = await db.select().from(professionalCategories).orderBy(asc(professionalCategories.sortOrder), asc(professionalCategories.name));
  return rows.map((c) => ({ ...c, usageCount: usage.find((u) => u.categoryId === c.id)?.n ?? 0 }));
}

export async function getCategoryAdmin(actor: Actor, id: string) {
  requireGlobalPermission(actor, "admin.categories.manage");
  const [c] = await db.select().from(professionalCategories).where(eq(professionalCategories.id, id)).limit(1);
  if (!c) throw new NotFoundError();
  const [u] = await db.select({ n: count() }).from(professionals).where(eq(professionals.primaryCategoryId, id));
  return { ...c, usageCount: u?.n ?? 0 };
}

export async function createCategory(actor: Actor, input: CategoryInput, executor: DbExecutor = db) {
  requireGlobalPermission(actor, "admin.categories.manage");
  assertCategory(input);
  const slug = slugify(input.slug?.trim() || input.name);
  const [dup] = await executor.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, slug)).limit(1);
  if (dup) throw new ConflictError("Ce slug existe déjà.");
  const [row] = await executor
    .insert(professionalCategories)
    .values({ slug, name: input.name.trim(), group: input.group.trim(), icon: input.icon, description: input.description?.trim() || null, isChildcare: input.isChildcare, formSchemaKey: input.formSchemaKey, defaultTools: input.defaultTools, suggestedTemplates: input.suggestedTemplates, sortOrder: input.sortOrder, isActive: input.isActive })
    .returning({ id: professionalCategories.id });
  await recordAudit(executor, { actorUserId: actor.userId, action: "admin.category.created", resourceType: "professional_category", resourceId: row?.id ?? null, metadata: { slug } });
  return row;
}

export async function updateCategory(actor: Actor, id: string, input: CategoryInput, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "admin.categories.manage");
  assertCategory(input);
  const [existing] = await executor.select().from(professionalCategories).where(eq(professionalCategories.id, id)).limit(1);
  if (!existing) throw new NotFoundError();
  const slug = slugify(input.slug?.trim() || existing.slug);
  if (slug !== existing.slug) {
    const [dup] = await executor.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, slug)).limit(1);
    if (dup) throw new ConflictError("Ce slug existe déjà.");
  }
  await executor
    .update(professionalCategories)
    .set({ slug, name: input.name.trim(), group: input.group.trim(), icon: input.icon, description: input.description?.trim() || null, isChildcare: input.isChildcare, formSchemaKey: input.formSchemaKey, defaultTools: input.defaultTools, suggestedTemplates: input.suggestedTemplates, sortOrder: input.sortOrder, isActive: input.isActive })
    .where(eq(professionalCategories.id, id));
  await recordAudit(executor, { actorUserId: actor.userId, action: "admin.category.updated", resourceType: "professional_category", resourceId: id, metadata: { slug, isActive: input.isActive, wasActive: existing.isActive } });
}

// ── Tools ────────────────────────────────────────────────────────────────────
export type ToolInput = { key?: string; name: string; description: string; audience: "organizer" | "professional" | "both"; requiredFeature: string | null; categorySlugs: string[]; isActive: boolean; sortOrder: number };

function assertTool(input: ToolInput): void {
  if (input.name.trim().length < 2) throw new ValidationError("Nom trop court.");
  if (!["organizer", "professional", "both"].includes(input.audience)) throw new ValidationError("Audience invalide.");
  if (input.requiredFeature && !(input.requiredFeature in FEATURES)) throw new ValidationError("Fonctionnalité inconnue.");
}

export async function listToolsAdmin(actor: Actor) {
  requireGlobalPermission(actor, "admin.tools.manage");
  const usage = await db
    .select({ toolKey: professionalToolActivations.toolKey, activations: count(), uses: sql<number>`coalesce(sum(${professionalToolActivations.usageCount}), 0)::int` })
    .from(professionalToolActivations)
    .where(eq(professionalToolActivations.enabled, true))
    .groupBy(professionalToolActivations.toolKey);
  const rows = await db.select().from(toolDefinitions).orderBy(asc(toolDefinitions.sortOrder));
  return rows.map((t) => {
    const u = usage.find((x) => x.toolKey === t.key);
    return { ...t, activations: u?.activations ?? 0, uses: u?.uses ?? 0 };
  });
}

export async function getToolAdmin(actor: Actor, key: string) {
  requireGlobalPermission(actor, "admin.tools.manage");
  const [t] = await db.select().from(toolDefinitions).where(eq(toolDefinitions.key, key)).limit(1);
  if (!t) throw new NotFoundError();
  return t;
}

export async function createTool(actor: Actor, input: ToolInput, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "admin.tools.manage");
  assertTool(input);
  const key = (input.key ?? "").trim();
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(key)) throw new ValidationError("Clé invalide (minuscules, chiffres, _).");
  const [dup] = await executor.select({ key: toolDefinitions.key }).from(toolDefinitions).where(eq(toolDefinitions.key, key)).limit(1);
  if (dup) throw new ConflictError("Cette clé existe déjà.");
  await executor.insert(toolDefinitions).values({ key, name: input.name.trim(), description: input.description.trim(), audience: input.audience, requiredFeature: input.requiredFeature, categorySlugs: input.categorySlugs, isActive: input.isActive, sortOrder: input.sortOrder });
  await recordAudit(executor, { actorUserId: actor.userId, action: "admin.tool.created", resourceType: "tool_definition", resourceId: key });
}

export async function updateTool(actor: Actor, key: string, input: ToolInput, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "admin.tools.manage");
  assertTool(input);
  const [row] = await executor
    .update(toolDefinitions)
    .set({ name: input.name.trim(), description: input.description.trim(), audience: input.audience, requiredFeature: input.requiredFeature, categorySlugs: input.categorySlugs, isActive: input.isActive, sortOrder: input.sortOrder })
    .where(eq(toolDefinitions.key, key))
    .returning({ key: toolDefinitions.key });
  if (!row) throw new NotFoundError();
  await recordAudit(executor, { actorUserId: actor.userId, action: "admin.tool.updated", resourceType: "tool_definition", resourceId: key, metadata: { isActive: input.isActive, requiredFeature: input.requiredFeature } });
}
