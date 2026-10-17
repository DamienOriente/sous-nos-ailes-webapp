import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/server/services/settings";
import { getPublishedVenueBySlug } from "@/server/services/venues";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { formatDateOnlyShort } from "@/lib/time";
import { VENUE_TYPE_LABELS } from "@/domain/labels";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { Section, SectionTitle } from "@/components/public/section";
import { VenueIllustration } from "@/components/illustrations/venue";
import { StatusBadge } from "@/components/ui/status-badge";
import { JsonLd } from "@/components/public/json-ld";
import { buttonClasses } from "@/components/ui/button";
import { paragraphsOf } from "@/server/services/settings";

export async function generateMetadata({ params }: PageProps<"/lieux/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getPublishedVenueBySlug(slug);
  if (!venue) return { title: "Lieu introuvable", robots: { index: false, follow: false } };
  return buildMetadata({ title: `Garde d’enfants au ${venue.name} (${venue.city})`, description: venue.summary, path: `/lieux/${venue.slug}`, noindex: venue.isDemo });
}

export default async function VenuePage({ params }: PageProps<"/lieux/[slug]">) {
  const { slug } = await params;
  const [venue, settings] = await Promise.all([getPublishedVenueBySlug(slug), getSettings()]);
  if (!venue) notFound();
  const facts: Array<{ label: string; value: string }> = [
    { label: "Type de lieu", value: VENUE_TYPE_LABELS[venue.type] },
    { label: "Commune", value: `${venue.postalCode ? `${venue.postalCode} ` : ""}${venue.city}${venue.region ? ` (${venue.region})` : ""}` },
  ];
  if (venue.lastVerifiedAt) facts.push({ label: "Informations vérifiées le", value: formatDateOnlyShort(venue.lastVerifiedAt) });
  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "EventVenue",
    name: venue.name,
    description: venue.summary,
    url: absoluteUrl(`/lieux/${venue.slug}`),
    address: { "@type": "PostalAddress", addressLocality: venue.city, ...(venue.postalCode ? { postalCode: venue.postalCode } : {}), addressCountry: "FR" },
    ...(venue.officialWebsite ? { sameAs: venue.officialWebsite } : {}),
  };
  return (
    <>
      <Breadcrumbs items={[{ name: "Lieux partenaires", path: "/lieux" }, { name: venue.name, path: `/lieux/${venue.slug}` }]} />
      <article>
        <header className="container-page grid gap-10 pt-8 pb-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-500">
              <span>{VENUE_TYPE_LABELS[venue.type]}</span>
              <span aria-hidden="true">·</span>
              <span>{venue.city}</span>
              {venue.isDemo ? <StatusBadge tone="clay">Lieu fictif de démonstration</StatusBadge> : null}
            </div>
            <h1 className="mt-3 font-display text-[2.5rem] leading-[1.08] sm:text-[3.25rem]">{venue.name}</h1>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-700 sm:text-lg">{venue.summary}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={`/demander-un-devis?lieu=${venue.slug}`} className={buttonClasses({ size: "lg" })}>
                Organiser la garde des enfants dans ce lieu
              </Link>
              {venue.officialWebsite ? (
                <a href={venue.officialWebsite} rel="noreferrer noopener" target="_blank" className="specimen-link self-start text-[15px] font-semibold text-sage-800 sm:self-auto">
                  Site officiel du lieu
                </a>
              ) : null}
            </div>
          </div>
          <VenueIllustration kind={venue.illustrationKey} className="w-full" />
        </header>
        <Section tone="paper" className="pt-10 sm:pt-12">
          <div className="grid gap-12 lg:grid-cols-[3fr_2fr] lg:gap-16">
            <div className="prose-lpi">
              <h2 className="!mt-0">Accueillir les enfants ici</h2>
              {paragraphsOf(venue.description).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            <aside className="flex flex-col gap-6">
              <dl className="label-card divide-y divide-sage-100 p-5">
                {facts.map((fact) => (
                  <div key={fact.label} className="py-2.5 first:pt-0 last:pb-0">
                    <dt className="text-[13px] font-semibold text-ink-500">{fact.label}</dt>
                    <dd className="text-[15px] text-ink-900">{fact.value}</dd>
                  </div>
                ))}
              </dl>
              {venue.childrenSpaces ? (
                <div>
                  <h3 className="font-sans text-lg font-semibold">Espaces pour les enfants</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-700">{venue.childrenSpaces}</p>
                </div>
              ) : null}
              {venue.constraints ? (
                <div>
                  <h3 className="font-sans text-lg font-semibold">Points de vigilance</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-700">{venue.constraints}</p>
                </div>
              ) : null}
              {venue.accessInfo ? (
                <div>
                  <h3 className="font-sans text-lg font-semibold">Accès</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-700">{venue.accessInfo}</p>
                </div>
              ) : null}
            </aside>
          </div>
        </Section>
        <Section>
          <div className="plate px-6 py-10 sm:px-12 sm:py-12">
            <SectionTitle>Un événement prévu au {venue.name} ?</SectionTitle>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-700">Le formulaire sera prérempli avec ce lieu. {settings.ownerFirstName} connaît déjà les espaces et les contraintes : la préparation va plus vite.</p>
            <Link href={`/demander-un-devis?lieu=${venue.slug}`} className={buttonClasses({ size: "lg", className: "mt-8" })}>
              Organiser la garde des enfants dans ce lieu
            </Link>
          </div>
        </Section>
      </article>
      <JsonLd data={placeJsonLd} />
    </>
  );
}
