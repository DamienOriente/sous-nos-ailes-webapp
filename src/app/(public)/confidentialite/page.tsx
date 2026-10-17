import type { Metadata } from "next";
import { getContent, getSettings, paragraphsOf } from "@/server/services/settings";
import { buildMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/public/page-intro";
import { Section } from "@/components/public/section";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = buildMetadata({ title: "Politique de confidentialité", description: "Quelles données sont collectées, pourquoi, combien de temps, et vos droits. Aucune donnée sur les enfants, aucun traceur publicitaire.", path: "/confidentialite" });

export default async function PrivacyPage() {
  const [settings, content] = await Promise.all([getSettings(), getContent("legal.privacy")]);
  return (
    <>
      <PageIntro title="Politique de confidentialité" crumbs={[{ name: "Confidentialité", path: "/confidentialite" }]} sprig="fern" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <div className="mx-auto max-w-3xl">
          <Alert kind="warning" title="Brouillon à compléter">
            Ce texte est une base de travail destinée à être relue et complétée avant toute exploitation réelle. Il n’a pas été validé juridiquement.
          </Alert>
          <div className="prose-lpi mt-8">
            {paragraphsOf(content.body).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <h2>Exercer vos droits</h2>
            <p>
              Pour toute demande d’accès, de rectification ou de suppression, écrivez à{" "}
              <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>. La procédure interne d’export et de suppression est décrite dans la documentation du projet.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
