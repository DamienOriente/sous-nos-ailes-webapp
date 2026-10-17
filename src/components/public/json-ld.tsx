import { serializeJsonLd } from "@/lib/seo";

/** Structured data must mirror visible content; callers pass only real values. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
