import type { Metadata } from "next";
import { getSettings } from "@/server/services/settings";
import { buildMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/public/page-intro";
import { Section, SectionTitle, Lead } from "@/components/public/section";
import { ProviderApplicationForm } from "@/components/public/forms";

export const metadata: Metadata = buildMetadata({ title: "Rejoindre le réseau d’intervenant·es", description: "Professionnel·les de la petite enfance, de l’animation ou de l’éducation : rejoignez le réseau de Marie pour des missions ponctuelles lors de mariages et d’événements.", path: "/rejoindre-le-reseau" });

export default async function JoinPage() {
  const settings = await getSettings();
  return (
    <>
      <PageIntro title="Rejoindre le réseau" lead="Des missions ponctuelles, le plus souvent le week-end, auprès d’enfants de tous âges, dans de beaux lieux. Vous restez libre d’accepter ou non chaque proposition." crumbs={[{ name: "Rejoindre le réseau", path: "/rejoindre-le-reseau" }]} sprig="sage" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <div className="grid gap-10 lg:grid-cols-[2fr_3fr] lg:gap-16">
          <div>
            <SectionTitle>Comment ça se passe</SectionTitle>
            <Lead>{settings.ownerFirstName} rencontre chaque personne avant de lui proposer une première mission.</Lead>
            <ul className="mt-6 grid gap-3 text-[15px] leading-relaxed text-ink-700">
              <li className="border-l border-sage-300 pl-4">Vous décrivez votre expérience et vos compétences ; les justificatifs sont vus lors d’un échange, jamais déposés en ligne.</li>
              <li className="border-l border-sage-300 pl-4">Vous recevez des propositions de mission par email avec les informations utiles ; vous acceptez ou refusez librement.</li>
              <li className="border-l border-sage-300 pl-4">Vous indiquez vos disponibilités et indisponibilités dans votre espace.</li>
              <li className="border-l border-sage-300 pl-4">Le cadre d’intervention (statut, rémunération, assurance) est en cours de validation et vous sera présenté clairement.</li>
            </ul>
          </div>
          <div className="plate p-6 sm:p-8">
            <h2 className="font-display text-2xl">Candidater</h2>
            <p className="mt-2 mb-6 text-[15px] leading-relaxed text-ink-500">Quelques lignes suffisent pour un premier contact.</p>
            <ProviderApplicationForm />
          </div>
        </div>
      </Section>
    </>
  );
}
