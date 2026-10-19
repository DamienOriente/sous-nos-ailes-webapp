// Evaluated per request: INDEXING_ENABLED and the published pages change without a rebuild.
export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { listIndexableDirectoryPaths } from "@/modules/directory/application/directory-paths";
import { listIndexablePagePaths } from "@/modules/pages/application/page-service";

export const revalidate = 3600;

const STATIC_PATHS: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/annuaire", priority: 0.9, changeFrequency: "daily" },
  { path: "/templates", priority: 0.4, changeFrequency: "monthly" },
  { path: "/tarifs", priority: 0.6, changeFrequency: "monthly" },
  { path: "/a-propos", priority: 0.4, changeFrequency: "yearly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/mentions-legales", priority: 0.1, changeFrequency: "yearly" },
  { path: "/confidentialite", priority: 0.1, changeFrequency: "yearly" },
];

/** Directory landing pages (category × geography) come from the directory module; a failure there must not break the sitemap. */
async function directoryPaths(): Promise<Array<{ path: string; lastModified?: Date }>> {
  try {
    return await listIndexableDirectoryPaths();
  } catch (err) {
    logger.warn({ err }, "sitemap: directory paths unavailable");
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!env.INDEXING_ENABLED) return [];
  const base = env.APP_URL.replace(/\/$/, "");
  const now = new Date();
  const [pages, directory] = await Promise.all([listIndexablePagePaths().catch(() => []), directoryPaths()]);
  return [
    ...STATIC_PATHS.map((s) => ({ url: `${base}${s.path}`, lastModified: now, changeFrequency: s.changeFrequency, priority: s.priority })),
    ...directory.map((d) => ({ url: `${base}${d.path}`, lastModified: d.lastModified ?? now, changeFrequency: "daily" as const, priority: 0.7 })),
    ...pages.map((p) => ({ url: `${base}${p.path}`, lastModified: p.lastModified, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
