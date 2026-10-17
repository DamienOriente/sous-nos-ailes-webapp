import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";
import { absoluteUrl } from "@/lib/seo";
import { listPublishedVenues } from "@/server/services/venues";

export const dynamic = "force-dynamic";

const STATIC_PATHS = ["/", "/prestations", "/mariages", "/evenements", "/a-propos", "/organisation", "/lieux", "/faq", "/demander-un-devis", "/devenir-partenaire", "/rejoindre-le-reseau", "/contact", "/confidentialite", "/mentions-legales"];

/** Only indexable pages: nothing while indexing is disabled, never demo venues. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const env = getEnv();
  if (!env.INDEXING_ENABLED) return [];
  const venues = await listPublishedVenues();
  const now = new Date();
  return [
    ...STATIC_PATHS.map((path) => ({ url: absoluteUrl(path), lastModified: now, changeFrequency: "monthly" as const, priority: path === "/" ? 1 : 0.7 })),
    ...venues.filter((v) => !v.isDemo).map((venue) => ({ url: absoluteUrl(`/lieux/${venue.slug}`), lastModified: venue.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
