import type { Metadata } from "next";
import Link from "next/link";
import { getSettings, listActiveOptions } from "@/server/services/settings";
import { buildMetadata, serviceJsonLd } from "@/lib/seo";
import { PageIntro } from "@/components/public/page-intro";
import { Section, SectionTitle, Lead } from "@/components/public/section";
import { ClosingInvitation } from "@/components/public/closing-invitation";
import { JsonLd } from "@/components/public/json-ld";
import { Sprig } from "@/components/illustrations/botanical";

const DESCRIPTION = "Garde et animation des enfants pendant un mariage, une fête privée ou un événement professionnel : espace dédié, activités par âge, équipe constituée par Marie, proposition sur mesure.";

export const metadata: Metadata = buildMetadata({ title: "Prestations de garde d’enfants en événement", description: DESCRIPTION, path: "/prestations" });

const INCLUDED = [
  { title: "Un espace à eux", text: "Repéré avec vous ou avec le lieu, à l’écart du bruit, aménagé avant l’arrivée des enfants : tapis, coin lecture, table d’ateliers, coin repos pour les plus petits." },
  { title: "Des activités par âge", text: "Ateliers manuels, jeux calmes ou grands jeux selon l’espace, lectures, musique douce en fin de soirée. Le programme suit le déroulé de votre événement." },
  { title: "Une équipe dimensionnée", text: "Le nombre d’intervenantes et d’intervenants dépend des effectifs, des âges et de la durée. Marie vous l’indique dans la proposition et constitue l’équipe parmi les personnes qu’elle connaît." },
  { title: "Un seul fil", text: "Marie qualifie la demande, prépare la proposition, briefe l’équipe et reste joignable pendant la prestation. Vous n’avez qu’une interlocutrice." },
];

export default async function ServicesPage() {
  const [settings, options] = await Promise.all([getSettings(), listActiveOptions()]);
  return (
    <>
      <PageIntro title="Prestations" lead={DESCRIPTION} crumbs={[{ name: "Prestations", path: "/prestations" }]} sprig="olive" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <SectionTitle>Ce qui est toujours compris</SectionTitle>
        <dl className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {INCLUDED.map((item) => (
            <div key={item.title} className="border-t border-sage-200 pt-5">
              <dt className="font-display text-2xl">{item.title}</dt>
              <dd className="mt-3 text-[15px] leading-relaxed text-ink-700">{item.text}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section>
        <div className="grid gap-10 lg:grid-cols-[2fr_3fr] lg:gap-16">
          <div>
            <SectionTitle>Les options</SectionTitle>
            <Lead>Elles s’ajoutent selon le lieu, l’heure et l’âge des enfants. Marie vous les propose quand elles ont du sens, jamais par défaut.</Lead>
          </div>
          <ul className="divide-y divide-sage-200 border-y border-sage-200">
            {options.map((option) => (
              <li key={option.id} className="flex gap-4 py-5">
                <Sprig kind="eucalyptus" size={36} className="shrink-0" />
                <div>
                  <p className="text-lg font-semibold text-ink-900">{option.label}</p>
                  {option.description ? <p className="mt-1 text-[15px] leading-relaxed text-ink-700">{option.description}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>
      <Section tone="sage">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionTitle light>Comment se construit le prix</SectionTitle>
            <Lead light>Pas de grille automatique : chaque proposition est établie par {settings.ownerFirstName} à partir de votre demande, puis ajustée après échange.</Lead>
          </div>
          <ul className="grid gap-4 text-[15px] leading-relaxed text-sage-100">
            <li className="border-l border-sage-500 pl-4">La durée de la garde et le nombre d’intervenant·es nécessaires, avec un minimum de prestation.</li>
            <li className="border-l border-sage-500 pl-4">Les horaires tardifs et le déplacement jusqu’au lieu.</li>
            <li className="border-l border-sage-500 pl-4">Les options retenues ensemble.</li>
            <li className="border-l border-sage-500 pl-4">Les conditions commerciales et le régime de TVA, qui seront précisés sur la proposition : rien n’est affiché ici tant que ces paramètres ne sont pas validés.</li>
          </ul>
        </div>
        <p className="mt-10 text-[15px] text-sage-100">
          Vous préférez poser une question avant de décrire votre événement ?{" "}
          <Link href="/contact" className="font-semibold text-ivory-50 underline">
            Écrivez à {settings.ownerFirstName}
          </Link>
          .
        </p>
      </Section>
      <Section tone="paper">
        <SectionTitle>Ce que nous ne faisons pas</SectionTitle>
        <ul className="mt-8 grid gap-4 text-[15px] leading-relaxed text-ink-700 md:grid-cols-3">
          <li>Nous ne sommes pas une crèche ni une structure agréée : nous accueillons des enfants pendant un événement, avec leurs parents à proximité ou joignables.</li>
          <li>Nous ne prenons pas en charge automatiquement les enfants de moins de 3 ans : chaque demande fait l’objet d’une étude spécifique avec {settings.ownerFirstName}.</li>
          <li>Nous ne collectons aucune donnée sur les enfants : ni nom, ni date de naissance, ni information médicale. Les consignes se transmettent de vive voix le jour J.</li>
        </ul>
      </Section>
      <ClosingInvitation ownerFirstName={settings.ownerFirstName} />
      <JsonLd data={serviceJsonLd({ name: "Garde d’enfants pour événements", description: DESCRIPTION, path: "/prestations", brandName: settings.brandName, serviceType: "Garde et animation d’enfants en événement" })} />
    </>
  );
}
