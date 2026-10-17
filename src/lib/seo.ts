import type { Metadata } from "next";
import { getEnv } from "@/lib/env";

export function absoluteUrl(path: string): string {
  return new URL(path, getEnv().APP_URL).toString();
}

/** Consistent metadata: unique title/description, canonical, Open Graph, noindex when required. */
export function buildMetadata(input: { title: string; description: string; path: string; noindex?: boolean; type?: "website" | "article" }): Metadata {
  const env = getEnv();
  const canonical = absoluteUrl(input.path);
  const index = env.INDEXING_ENABLED && !input.noindex;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      type: input.type ?? "website",
      locale: "fr_FR",
    },
  };
}

/** Serialises JSON-LD safely for a <script> tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationJsonLd(settings: { brandName: string; tagline: string; contactEmail: string; contactPhone: string | null }) {
  const env = getEnv();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.brandName,
    url: env.APP_URL,
    description: settings.tagline,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: settings.contactEmail,
        ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
        availableLanguage: ["fr"],
      },
    ],
  };
}

export function serviceJsonLd(input: { name: string; description: string; path: string; brandName: string; serviceType: string; audience?: string }) {
  const env = getEnv();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    serviceType: input.serviceType,
    url: absoluteUrl(input.path),
    provider: { "@type": "Organization", name: input.brandName, url: env.APP_URL },
    areaServed: { "@type": "Country", name: "France" },
    ...(input.audience ? { audience: { "@type": "Audience", audienceType: input.audience } } : {}),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
