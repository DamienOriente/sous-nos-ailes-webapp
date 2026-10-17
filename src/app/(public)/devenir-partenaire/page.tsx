import type { Metadata } from "next";
import { getSettings } from "@/server/services/settings";
import { buildMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/public/page-intro";
import { Section, SectionTitle, Lead } from "@/components/public/section";
import { PartnerApplicationForm } from "@/components/public/forms";

export const metadata: Metadata = buildMetadata({ title: "Devenir lieu partenaire", description: "Lieux de réception, domaines, salles : proposez la garde d’enfants à vos couples et organisateurs, avec une page documentée, un lien d’apport et un suivi des demandes.", path: "/devenir-partenaire" });

export default async function PartnerPage() {
  const settings = await getSettings();
  return (
    <>
      <PageIntro title="Devenir lieu partenaire" lead="Vous accueillez des mariages et des réceptions. Proposer un accueil enfants organisé rassure vos clients et simplifie vos soirées." crumbs={[{ name: "Devenir partenaire", path: "/devenir-partenaire" }]} sprig="olive" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <div className="grid gap-10 lg:grid-cols-[2fr_3fr] lg:gap-16">
          <div>
            <SectionTitle>Ce que comprend le partenariat</SectionTitle>
            <Lead>Aucune commission n’est prévue par défaut : le partenariat repose sur une page utile et une organisation partagée.</Lead>
            <ul className="mt-6 grid gap-3 text-[15px] leading-relaxed text-ink-700">
              <li className="border-l border-sage-300 pl-4">Une page dédiée à votre lieu, rédigée avec vous : espaces adaptés aux enfants, contraintes, accès. Sans copier votre site.</li>
              <li className="border-l border-sage-300 pl-4">Un lien et un QR code à transmettre à vos clients, avec un kit de présentation imprimable.</li>
              <li className="border-l border-sage-300 pl-4">Des statistiques agrégées sur les demandes apportées et les prestations confirmées, sans aucune donnée nominative.</li>
              <li className="border-l border-sage-300 pl-4">Une mémoire opérationnelle du lieu, utile à chaque nouvelle mission chez vous.</li>
            </ul>
          </div>
          <div className="plate p-6 sm:p-8">
            <h2 className="font-display text-2xl">Proposer un partenariat</h2>
            <p className="mt-2 mb-6 text-[15px] leading-relaxed text-ink-500">{settings.ownerFirstName} vous recontacte pour échanger sur votre lieu et préparer sa page.</p>
            <PartnerApplicationForm />
          </div>
        </div>
      </Section>
    </>
  );
}
