import type { Metadata } from "next";
import { getSettings } from "@/server/services/settings";
import { buildMetadata, serviceJsonLd } from "@/lib/seo";
import { PageIntro } from "@/components/public/page-intro";
import { Section, SectionTitle, Lead } from "@/components/public/section";
import { ClosingInvitation } from "@/components/public/closing-invitation";
import { JsonLd } from "@/components/public/json-ld";

const DESCRIPTION = "Garde et animation d’enfants pour vos fêtes privées (anniversaires, baptêmes, réunions de famille) et vos événements professionnels ouverts aux familles, organisées avec le lieu et l’organisateur.";

export const metadata: Metadata = buildMetadata({ title: "Événements privés et professionnels", description: DESCRIPTION, path: "/evenements" });

export default async function EventsPage() {
  const settings = await getSettings();
  return (
    <>
      <PageIntro title="Événements privés et professionnels" lead={DESCRIPTION} crumbs={[{ name: "Événements", path: "/evenements" }]} sprig="eucalyptus" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionTitle>Fêtes privées</SectionTitle>
            <div className="prose-lpi mt-5">
              <p>Anniversaire marquant, baptême, cousinade, fête de famille : les adultes veulent se retrouver, les enfants veulent jouer. Nous installons un espace à eux, proposons des activités adaptées aux âges présents et gérons le rythme de l’après-midi ou de la soirée.</p>
              <p>À la maison, dans un jardin ou dans une salle louée, l’équipe s’adapte à l’espace réel : {settings.ownerFirstName} le repère avec vous avant de dimensionner l’équipe.</p>
            </div>
          </div>
          <div>
            <SectionTitle>Événements professionnels</SectionTitle>
            <div className="prose-lpi mt-5">
              <p>Journée d’entreprise ouverte aux familles, séminaire avec conjoints et enfants, inauguration, arbre de Noël : un accueil enfants organisé rend l’événement réellement accessible aux parents.</p>
              <p>Nous travaillons avec l’organisateur et le lieu sur les horaires, les flux et l’espace, et fournissons un déroulé clair que vous pouvez communiquer à vos invités.</p>
            </div>
          </div>
        </div>
      </Section>
      <Section>
        <SectionTitle>Ce qui change selon le contexte</SectionTitle>
        <Lead>Même exigence, organisation différente. Voici ce que {settings.ownerFirstName} regarde en premier.</Lead>
        <dl className="mt-10 grid gap-8 border-t border-sage-200 pt-8 md:grid-cols-3">
          <div>
            <dt className="font-display text-xl">Durée et horaires</dt>
            <dd className="mt-2 text-[15px] leading-relaxed text-ink-700">Un goûter de deux heures ne s’organise pas comme une soirée qui passe minuit : effectif, pauses et temps calmes en découlent.</dd>
          </div>
          <div>
            <dt className="font-display text-xl">Présence des parents</dt>
            <dd className="mt-2 text-[15px] leading-relaxed text-ink-700">Parents sur place, joignables ou absents : la remise et la reprise des enfants, les consignes et le niveau d’autonomie ne sont pas les mêmes.</dd>
          </div>
          <div>
            <dt className="font-display text-xl">L’espace disponible</dt>
            <dd className="mt-2 text-[15px] leading-relaxed text-ink-700">Pièce dédiée, zone délimitée dans une salle unique ou extérieur : l’espace détermine les activités possibles et la façon de sécuriser.</dd>
          </div>
        </dl>
      </Section>
      <ClosingInvitation ownerFirstName={settings.ownerFirstName} />
      <JsonLd data={serviceJsonLd({ name: "Garde d’enfants pour événements privés et professionnels", description: DESCRIPTION, path: "/evenements", brandName: settings.brandName, serviceType: "Garde d’enfants en événement" })} />
    </>
  );
}
