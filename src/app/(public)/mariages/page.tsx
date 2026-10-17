import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/services/settings";
import { buildMetadata, serviceJsonLd } from "@/lib/seo";
import { PageIntro } from "@/components/public/page-intro";
import { Section, SectionTitle, Lead } from "@/components/public/section";
import { ClosingInvitation } from "@/components/public/closing-invitation";
import { JsonLd } from "@/components/public/json-ld";

const DESCRIPTION = "Garde d’enfants pendant un mariage : un espace aménagé dans le lieu de réception, des activités du vin d’honneur à l’ouverture du bal, une équipe coordonnée par Marie et briefée avec le lieu.";

export const metadata: Metadata = buildMetadata({ title: "Garde d’enfants pour votre mariage", description: DESCRIPTION, path: "/mariages" });

const MOMENTS = [
  { label: "Cérémonie et vin d’honneur", text: "Les plus petits bougent, les grands s’ennuient vite. Nous proposons un coin jeux calme à portée de regard des parents, pour que les discours restent audibles et les enfants occupés." },
  { label: "Le dîner", text: "Table des enfants animée ou dîner à part dans leur espace, selon votre choix et celui du traiteur. L’équipe gère le rythme, les retours vers les parents, les petits incidents." },
  { label: "La soirée", text: "Ouverture du bal avec les enfants puis, pour ceux qui restent, veillée : lectures, jeux de société, coin repos avec tapis et couvertures. Retour aux familles aux horaires convenus." },
];

export default async function WeddingsPage() {
  const settings = await getSettings();
  return (
    <>
      <PageIntro title="Mariages" lead={DESCRIPTION} crumbs={[{ name: "Mariages", path: "/mariages" }]} sprig="olive" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <SectionTitle>Les enfants au mariage, moment par moment</SectionTitle>
        <ol className="mt-10 divide-y divide-sage-200 border-y border-sage-200">
          {MOMENTS.map((moment) => (
            <li key={moment.label} className="grid grid-cols-[96px_1fr] gap-4 py-7 md:grid-cols-[240px_1fr] md:gap-10">
              <p className="text-[15px] font-semibold text-clay-700">{moment.label}</p>
              <p className="max-w-2xl text-[15px] leading-relaxed text-ink-700">{moment.text}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionTitle>Avec votre lieu de réception</SectionTitle>
            <Lead>Un espace enfants réussi se décide avec le lieu : quelle pièce, quel accès, quelles contraintes. Quand le lieu est partenaire, ces informations sont déjà documentées ; sinon, {settings.ownerFirstName} les recueille avec vous.</Lead>
            <Link href="/lieux" className="specimen-link mt-6 inline-block text-[15px] font-semibold text-sage-800">
              Voir les lieux partenaires
            </Link>
          </div>
          <div>
            <SectionTitle>Ce que nous vous demanderons</SectionTitle>
            <ul className="mt-6 grid gap-3 text-[15px] leading-relaxed text-ink-700">
              <li className="border-l border-sage-300 pl-4">La date, les horaires de garde souhaités et le lieu.</li>
              <li className="border-l border-sage-300 pl-4">Le nombre d’enfants par tranche d’âge, sans aucune information nominative.</li>
              <li className="border-l border-sage-300 pl-4">Si des parents restent joignables sur place et l’espace que vous envisagez pour les enfants.</li>
              <li className="border-l border-sage-300 pl-4">Vos envies : dîner à part, veillée, ateliers particuliers.</li>
            </ul>
          </div>
        </div>
      </Section>
      <Section tone="sage">
        <SectionTitle light>Ce qu’il faut savoir</SectionTitle>
        <div className="mt-8 grid gap-6 text-[15px] leading-relaxed text-sage-100 md:grid-cols-3">
          <p>Les enfants de moins de 3 ans font l’objet d’une étude spécifique : espace de repos, horaires, présence des parents. Aucune prise en charge n’est automatique.</p>
          <p>Les intervenantes et intervenants sont des indépendants choisis par {settings.ownerFirstName}. Leurs qualifications déclarées sont indiquées comme vérifiées seulement après contrôle.</p>
          <p>La prestation est confirmée une fois votre accord de principe donné, l’équipe constituée et les points pratiques validés : votre espace client suit chaque étape.</p>
        </div>
      </Section>
      <ClosingInvitation ownerFirstName={settings.ownerFirstName} />
      <JsonLd data={serviceJsonLd({ name: "Garde d’enfants pour mariages", description: DESCRIPTION, path: "/mariages", brandName: settings.brandName, serviceType: "Garde d’enfants lors de mariages", audience: "Futurs mariés" })} />
    </>
  );
}
