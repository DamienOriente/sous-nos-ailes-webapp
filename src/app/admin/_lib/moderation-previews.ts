import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAssets, professionalCategories, professionals, profileVersions, publicProfiles } from "@/db/schema";

/**
 * Visual hints for the moderation queue: cover file, trade (for the fallback
 * ambience photo) and the template of the version awaiting review. Read-only
 * presentation helper of the admin area; nothing here decides anything.
 */
export type ModerationPreview = { professionalId: string; coverFileId: string | null; categorySlug: string | null; templateKey: string | null; status: string };

export async function getModerationPreviews(professionalIds: string[]): Promise<Map<string, ModerationPreview>> {
  const ids = [...new Set(professionalIds)].filter(Boolean);
  const out = new Map<string, ModerationPreview>();
  if (ids.length === 0) return out;
  const pros = await db
    .select({ id: professionals.id, status: professionals.status, categorySlug: professionalCategories.slug })
    .from(professionals)
    .leftJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(inArray(professionals.id, ids));
  for (const p of pros) out.set(p.id, { professionalId: p.id, coverFileId: null, categorySlug: p.categorySlug, templateKey: null, status: p.status });

  const covers = await db
    .select({ professionalId: mediaAssets.professionalId, fileId: mediaAssets.fileId })
    .from(mediaAssets)
    .where(and(inArray(mediaAssets.professionalId, ids), eq(mediaAssets.kind, "cover")))
    .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.createdAt));
  for (const c of covers) {
    const p = out.get(c.professionalId);
    if (p && !p.coverFileId) p.coverFileId = c.fileId;
  }

  const versions = await db
    .select({ professionalId: publicProfiles.professionalId, templateKey: profileVersions.templateKey, status: profileVersions.status, versionNumber: profileVersions.versionNumber })
    .from(profileVersions)
    .innerJoin(publicProfiles, eq(publicProfiles.id, profileVersions.publicProfileId))
    .where(inArray(publicProfiles.professionalId, ids))
    .orderBy(asc(profileVersions.versionNumber));
  // Submitted version first, otherwise the latest known template.
  for (const v of versions) {
    const p = out.get(v.professionalId);
    if (!p) continue;
    if (v.status === "submitted" || !p.templateKey) p.templateKey = v.templateKey;
  }
  return out;
}
