import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/services/settings";
import { listPublishedVenues } from "@/server/services/venues";
import { buildMetadata } from "@/lib/seo";
import { VENUE_TYPE_LABELS } from "@/domain/labels";
import { PageIntro } from "@/components/public/page-intro";
import { Section, SectionTitle, Lead } from "@/components/public/section";
import { VenueIllustration } from "@/components/illustrations/venue";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = buildMetadata({ title: "Lieux partenaires", description: "Les lieux de réception avec lesquels nous travaillons : espaces pour les enfants, contraintes, accès. Des pages documentées pour préparer la garde des enfants dans votre lieu.", path: "/lieux" });

export default async function VenuesPage() {
  const [settings, venues] = await Promise.all([getSettings(), listPublishedVenues()]);
  return (
    <>
      <PageIntro title="Lieux partenaires" lead="Chaque page décrit ce qui compte pour accueillir des enfants dans le lieu : les espaces, les points de vigilance, l’accès. Rédigées avec le lieu, vérifiées régulièrement." crumbs={[{ name: "Lieux partenaires", path: "/lieux" }]} sprig="olive" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        {venues.length === 0 ? (
          <EmptyState title="Aucun lieu publié pour le moment" description="Les pages de lieux partenaires apparaîtront ici dès qu’elles auront été validées." />
        ) : (
          <ul className="grid gap-x-10 gap-y-14 md:grid-cols-2">
            {venues.map((venue) => (
              <li key={venue.id} className="flex flex-col">
                <Link href={`/lieux/${venue.slug}`} className="group block">
                  <VenueIllustration kind={venue.illustrationKey} className="w-full transition-transform duration-300 ease-out group-hover:-translate-y-0.5" />
                </Link>
                <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-ink-500">
                  <span>{VENUE_TYPE_LABELS[venue.type]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{venue.city}</span>
                  {venue.isDemo ? <StatusBadge tone="clay">Lieu fictif de démonstration</StatusBadge> : null}
                </div>
                <h2 className="mt-2 font-display text-2xl">
                  <Link href={`/lieux/${venue.slug}`} className="specimen-link">
                    {venue.name}
                  </Link>
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-700">{venue.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section>
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionTitle>Votre lieu n’est pas dans la liste ?</SectionTitle>
            <Lead>Aucun problème : indiquez-le simplement dans votre demande. {settings.ownerFirstName} recueille avec vous les informations utiles.</Lead>
          </div>
          <div>
            <SectionTitle>Vous gérez un lieu de réception ?</SectionTitle>
            <Lead>Une page documentée, un lien d’apport et un suivi des demandes, sans commission par défaut.</Lead>
            <Link href="/devenir-partenaire" className="specimen-link mt-6 inline-block text-[15px] font-semibold text-sage-800">
              Devenir lieu partenaire
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
