import type { Metadata } from "next";
import { getContent, paragraphsOf } from "@/server/services/settings";
import { buildMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/public/page-intro";
import { Section } from "@/components/public/section";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = buildMetadata({ title: "Mentions légales", description: "Éditeur, responsable de publication et hébergeur du site (brouillon à compléter).", path: "/mentions-legales" });

export default async function LegalPage() {
  const content = await getContent("legal.mentions");
  return (
    <>
      <PageIntro title="Mentions légales" crumbs={[{ name: "Mentions légales", path: "/mentions-legales" }]} sprig="fern" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <div className="mx-auto max-w-3xl">
          <Alert kind="warning" title="Brouillon à compléter">
            Les informations ci-dessous sont des champs à renseigner. Le nom commercial est provisoire et sa disponibilité n’a pas été vérifiée.
          </Alert>
          <div className="prose-lpi mt-8">
            {paragraphsOf(content.body).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
