import type { Metadata } from "next";
import { getContent, getSettings, paragraphsOf } from "@/server/services/settings";
import { buildMetadata } from "@/lib/seo";
import { STEPS } from "@/content/site";
import { PageIntro } from "@/components/public/page-intro";
import { Section, SectionTitle, Lead } from "@/components/public/section";
import { ClosingInvitation } from "@/components/public/closing-invitation";

export const metadata: Metadata = buildMetadata({ title: "Notre organisation", description: "Comment une demande devient une prestation : qualification par Marie, proposition datée, accord de principe, constitution de l’équipe, validation des points pratiques, confirmation.", path: "/organisation" });

export default async function OrganisationPage() {
  const [settings, content] = await Promise.all([getSettings(), getContent("organisation.body")]);
  return (
    <>
      <PageIntro title="Notre organisation" lead="Rien n’est automatique : voici, étape par étape, comment une demande devient une prestation confirmée." crumbs={[{ name: "Notre organisation", path: "/organisation" }]} sprig="fern" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <div className="prose-lpi">
          {paragraphsOf(content.body).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </Section>
      <Section tone="sage">
        <SectionTitle light>Les étapes</SectionTitle>
        <ol className="mt-10 divide-y divide-sage-500/60 border-y border-sage-500/60">
          {STEPS.map((step) => (
            <li key={step.label} className="grid grid-cols-[96px_1fr] gap-4 py-6 md:grid-cols-[200px_1fr] md:gap-10">
              <p className="text-[15px] font-semibold text-clay-200">{step.label}</p>
              <div className="max-w-2xl">
                <h3 className="font-display text-[1.35rem] leading-tight text-ivory-50">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-sage-100">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionTitle>Le réseau d’intervenant·es</SectionTitle>
            <Lead>Des indépendantes et indépendants que {settings.ownerFirstName} connaît, rencontre et choisit pour chaque mission.</Lead>
            <ul className="mt-6 grid gap-3 text-[15px] leading-relaxed text-ink-700">
              <li className="border-l border-sage-300 pl-4">Chaque personne déclare ses compétences et qualifications ; {settings.ownerFirstName} indique celles qu’elle a pu vérifier. Une déclaration n’est jamais présentée comme une certification.</li>
              <li className="border-l border-sage-300 pl-4">Une mission est proposée, jamais imposée : la personne accepte ou refuse librement, et l’affectation finale revient à {settings.ownerFirstName}.</li>
              <li className="border-l border-sage-300 pl-4">Les coordonnées des clients ne sont transmises qu’à l’équipe affectée, et seulement ce qui est utile le jour J.</li>
            </ul>
          </div>
          <div>
            <SectionTitle>L’effectif</SectionTitle>
            <Lead>Le nombre d’intervenant·es dépend des effectifs par âge, de la durée et du lieu.</Lead>
            <p className="mt-6 text-[15px] leading-relaxed text-ink-700">{settings.ownerFirstName} s’appuie sur des repères internes de bonne organisation, qu’elle adapte à chaque situation et indique dans la proposition. Ces repères sont des choix d’organisation en cours de validation : ils ne sont pas présentés comme des ratios réglementaires.</p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-700">Le cadre contractuel et économique de l’activité (statut, assurance, conditions commerciales) est en cours de validation et sera publié ici une fois arrêté.</p>
          </div>
        </div>
      </Section>
      <ClosingInvitation ownerFirstName={settings.ownerFirstName} />
    </>
  );
}
