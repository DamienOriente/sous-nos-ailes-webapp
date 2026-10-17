import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { getLegalDocument } from "@/modules/legal/application/legal-pages";
import { LEGAL_DEFAULTS } from "@/modules/legal/domain/defaults";

const SLUG = "mentions-legales" as const;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: LEGAL_DEFAULTS[SLUG].title,
  description: LEGAL_DEFAULTS[SLUG].summary,
  alternates: { canonical: `/${SLUG}` },
};

export default async function Page() {
  const document = await getLegalDocument(SLUG);
  return (
    <>
      <LegalDocument document={document} />
    </>
  );
}
