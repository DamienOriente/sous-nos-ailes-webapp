import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { CookiePreferences } from "@/components/privacy/cookie-preferences";
import { Container } from "@/components/shared/section";
import { getLegalDocument } from "@/modules/legal/application/legal-pages";
import { LEGAL_DEFAULTS } from "@/modules/legal/domain/defaults";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: LEGAL_DEFAULTS.cookies.title,
  description: LEGAL_DEFAULTS.cookies.summary,
  alternates: { canonical: "/cookies" },
};

export default async function CookiesPage() {
  const document = await getLegalDocument("cookies");
  return (
    <>
      <LegalDocument document={document} />
      <Container className="pb-16">
        <div className="max-w-3xl lg:ml-[260px]">
          <CookiePreferences />
        </div>
      </Container>
    </>
  );
}
