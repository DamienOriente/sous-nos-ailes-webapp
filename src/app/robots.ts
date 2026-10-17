import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

// robots.txt is a crawling hint, not a security control: private spaces are
// protected by authentication regardless of what is listed here.
export default function robots(): MetadataRoute.Robots {
  const env = getEnv();
  if (!env.INDEXING_ENABLED) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/espace-client", "/espace-intervenant", "/espace-partenaire", "/connexion", "/api", "/p/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
