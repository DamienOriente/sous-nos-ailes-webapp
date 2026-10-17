// Evaluated per request: INDEXING_ENABLED and the published pages change without a rebuild.
export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** Private areas are never crawlable; the whole site stays closed until INDEXING_ENABLED is on. */
export default function robots(): MetadataRoute.Robots {
  if (!env.INDEXING_ENABLED) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app/", "/admin/", "/onboarding/", "/api/", "/connexion", "/inscription", "/mot-de-passe-oublie"] },
    sitemap: `${env.APP_URL}/sitemap.xml`,
    host: env.APP_URL,
  };
}
