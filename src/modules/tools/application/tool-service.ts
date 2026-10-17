import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalCategories, professionalCategoryAssignments, professionalToolActivations, professionals, toolDefinitions } from "@/db/schema";
import { NotFoundError, PaymentRequiredError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireProfessionalManage } from "@/modules/authorization";
import { getEffectivePlan, planHasFeature } from "@/modules/billing/application/entitlements";
import type { FeatureKey } from "@/modules/billing/domain/plans";
import { TOOL_SEED } from "@/modules/tools/domain/tool-catalogue";

export type ToolCard = {
  key: string;
  name: string;
  description: string;
  requiredFeature: FeatureKey | null;
  /** The plan of the listing owner grants the feature (or the tool is free). */
  entitled: boolean;
  enabled: boolean;
  usageCount: number;
  lastUsedAt: Date | null;
  href: string;
  icon: string;
  /** Default for the trade (pre-enabled at onboarding). */
  isDefault: boolean;
};

/** Primary + secondary categories of a listing (slugs and default tool keys). */
async function listingCategories(professionalId: string, executor: DbExecutor): Promise<{ slugs: Set<string>; defaults: Set<string> }> {
  const primary = await executor
    .select({ slug: professionalCategories.slug, defaultTools: professionalCategories.defaultTools })
    .from(professionals)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(eq(professionals.id, professionalId));
  const secondary = await executor
    .select({ slug: professionalCategories.slug, defaultTools: professionalCategories.defaultTools })
    .from(professionalCategoryAssignments)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionalCategoryAssignments.categoryId))
    .where(eq(professionalCategoryAssignments.professionalId, professionalId));
  const all = [...primary, ...secondary];
  return { slugs: new Set(all.map((c) => c.slug)), defaults: new Set(all.flatMap((c) => c.defaultTools)) };
}

/**
 * Catalogue visible in the workspace: active tools for professionals whose
 * category list is empty or intersects the listing's categories. Premium
 * tools are returned locked (entitled = false) so the UI can show the paywall.
 */
export async function listToolsForListing(actor: Actor, professionalId: string, executor: DbExecutor = db): Promise<ToolCard[]> {
  const access = await requireProfessionalManage(actor, professionalId, executor);
  const { slugs, defaults } = await listingCategories(professionalId, executor);

  const defs = await executor
    .select()
    .from(toolDefinitions)
    .where(and(eq(toolDefinitions.isActive, true), inArray(toolDefinitions.audience, ["professional", "both"])))
    .orderBy(asc(toolDefinitions.sortOrder));
  const relevant = defs.filter((d) => d.categorySlugs.length === 0 || d.categorySlugs.some((s) => slugs.has(s)));

  const plan = await getEffectivePlan(access.ownerUserId, "professional", professionalId, executor);
  const activations = await executor.select().from(professionalToolActivations).where(eq(professionalToolActivations.professionalId, professionalId));
  const seedByKey = new Map(TOOL_SEED.map((t) => [t.key, t]));

  return relevant.map((d) => {
    const a = activations.find((x) => x.toolKey === d.key);
    const feature = (d.requiredFeature as FeatureKey | null) ?? null;
    const entitled = !feature || planHasFeature(plan, feature);
    const seed = seedByKey.get(d.key);
    return {
      key: d.key,
      name: d.name,
      description: d.description,
      requiredFeature: feature,
      entitled,
      enabled: a ? a.enabled && entitled : false,
      usageCount: a?.usageCount ?? 0,
      lastUsedAt: a?.lastUsedAt ?? null,
      href: resolveToolHref(seed?.href ?? "", professionalId),
      icon: seed?.icon ?? "wrench",
      isDefault: defaults.has(d.key),
    };
  });
}

/** Catalogue hrefs are absolute (/app/...), relative to the workspace, or legacy "/pro/espace/*" (mapped to the workspace). */
export function resolveToolHref(href: string, professionalId: string): string {
  if (!href) return `/app/pro/${professionalId}`;
  if (href.startsWith("/pro/espace/")) return `/app/pro/${professionalId}/${href.slice("/pro/espace/".length)}`;
  if (href.startsWith("/")) return href;
  return `/app/pro/${professionalId}/${href}`;
}

export async function setToolEnabled(actor: Actor, professionalId: string, toolKey: string, enabled: boolean, executor: DbExecutor = db): Promise<void> {
  const access = await requireProfessionalManage(actor, professionalId, executor);
  const [def] = await executor.select().from(toolDefinitions).where(and(eq(toolDefinitions.key, toolKey), eq(toolDefinitions.isActive, true))).limit(1);
  if (!def) throw new NotFoundError();
  if (enabled && def.requiredFeature) {
    const plan = await getEffectivePlan(access.ownerUserId, "professional", professionalId, executor);
    if (!planHasFeature(plan, def.requiredFeature as FeatureKey)) throw new PaymentRequiredError();
  }
  await executor
    .insert(professionalToolActivations)
    .values({ professionalId, toolKey, enabled })
    .onConflictDoUpdate({ target: [professionalToolActivations.professionalId, professionalToolActivations.toolKey], set: { enabled } });
}

/** Pre-enables the free default tools of the trade (idempotent). */
export async function activateDefaultTools(professionalId: string, executor: DbExecutor = db): Promise<void> {
  const { defaults } = await listingCategories(professionalId, executor);
  if (!defaults.size) return;
  const free = await executor
    .select({ key: toolDefinitions.key })
    .from(toolDefinitions)
    .where(and(inArray(toolDefinitions.key, [...defaults]), eq(toolDefinitions.isActive, true), sql`${toolDefinitions.requiredFeature} is null`));
  for (const t of free) {
    await executor.insert(professionalToolActivations).values({ professionalId, toolKey: t.key, enabled: true }).onConflictDoNothing();
  }
}

/** Marks a usage (called by trade tools when opened). */
export async function touchTool(professionalId: string, toolKey: string, executor: DbExecutor = db): Promise<void> {
  await executor
    .update(professionalToolActivations)
    .set({ usageCount: sql`${professionalToolActivations.usageCount} + 1`, lastUsedAt: new Date() })
    .where(and(eq(professionalToolActivations.professionalId, professionalId), eq(professionalToolActivations.toolKey, toolKey)));
}
