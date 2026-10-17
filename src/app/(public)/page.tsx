import type { Metadata } from "next";
import Link from "next/link";
import { getSettings, getContent, paragraphsOf } from "@/server/services/settings";
import { buildMetadata } from "@/lib/seo";
import { CTA_HREF, CTA_LABEL, EVENT_FAMILIES, FAQ_ITEMS, STEPS } from "@/content/site";
import { HerbariumPlate, PortraitPlaceholder, Sprig } from "@/components/illustrations/botanical";
import { buttonClasses } from "@/components/ui/button";
import { Section, SectionTitle, Lead } from "@/components/public/section";
import { Testimonials } from "@/components/public/testimonials";
import { ClosingInvitation } from "@/components/public/closing-invitation";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    title: `${settings.brandName} — garde d’enfants pour mariages et événements`,
    description: `${settings.tagline} Garde et animation des enfants pendant votre mariage, votre fête ou votre événement professionnel, coordonnées par ${settings.ownerFirstName}.`,
    path: "/",
  });
}

export default async function HomePage() {
  const [settings, intro, approach] = await Promise.all([getSettings(), getContent("home.intro"), getContent("approach.body")]);
  const approachParagraphs = paragraphsOf(approach.body);
  const essentialFaq = FAQ_ITEMS.slice(0, 4);

  return (
    <>
      {/* Hero: the plate */}
      <section className="pt-10 pb-12 sm:pt-14 lg:pt-20 lg:pb-16">
        <div className="container-page grid items-center gap-10 lg:grid-cols-[11fr_9fr] lg:gap-14">
          <div className="max-w-2xl">
            <h1 className="font-display text-[2.5rem] leading-[1.08] text-ink-900 sm:text-[3.25rem] lg:text-[4.25rem] lg:leading-[1.04]">{settings.tagline}</h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-700 sm:text-xl sm:leading-relaxed">{intro.body}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <Link href={CTA_HREF} className={buttonClasses({ size: "lg" })}>
                {CTA_LABEL}
              </Link>
              <Link href="/prestations" className="specimen-link self-start text-[15px] font-semibold text-sage-800 sm:self-auto">
                Découvrir les prestations
              </Link>
            </div>
          </div>
          {/* From 640 px the label hangs off the sheet's lower-right corner, never over a specimen; the column reserves its height */}
          <div className="sm:pb-44">
            <div className="relative">
              {/* Mobile: plate cropped 4:3 (anchored on its lower half); from 640 px the full sheet */}
              <div className="aspect-[4/3] overflow-hidden rounded-lg sm:aspect-auto sm:overflow-visible sm:rounded-none">
                <HerbariumPlate className="h-full w-full drop-shadow-[0_18px_40px_-24px_rgba(31,47,39,0.45)]" />
              </div>
              <div className="label-card mt-4 p-4 sm:absolute sm:top-full sm:right-6 sm:-mt-6 sm:w-72 sm:p-5">
              <p className="text-[13px] font-semibold text-clay-700">Événements accompagnés</p>
              <ul className="mt-2 flex flex-col gap-1 text-[15px] text-ink-900">
                {EVENT_FAMILIES.map((family) => (
                  <li key={family.key}>{family.title}</li>
                ))}
              </ul>
              <p className="mt-3 border-t border-sage-100 pt-3 text-[13px] leading-snug text-ink-500">{settings.areaLabel}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specimen labels strip */}
      <div className="container-page mt-6 lg:mt-2">
        <ul className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-sage-200 pt-5 text-[15px] font-medium text-sage-800">
          {EVENT_FAMILIES.map((family) => (
            <li key={family.key} className="flex items-center gap-2">
              <Sprig kind={family.sprig} size={28} />
              <Link href={family.href} className="specimen-link">
                {family.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Event families, as catalogue entries (not cards) */}
      <Section>
        <SectionTitle>Les événements que nous accompagnons</SectionTitle>
        <Lead>Trois contextes, une même exigence : les enfants ont un espace à eux, des activités adaptées à leur âge et des adultes attentifs du premier au dernier instant.</Lead>
        <dl className="mt-12 grid gap-10 border-t border-sage-200 pt-10 md:grid-cols-3 md:gap-8">
          {EVENT_FAMILIES.map((family) => (
            <div key={family.key} className="flex flex-col">
              <Sprig kind={family.sprig} size={52} className="-ml-2" />
              <dt className="mt-3 font-display text-2xl text-ink-900">{family.title}</dt>
              <dd className="mt-3 text-[15px] leading-relaxed text-ink-700">{family.summary}</dd>
              <dd className="mt-4">
                <Link href={family.href} className="specimen-link text-[15px] font-semibold text-sage-800">
                  En savoir plus
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Steps: one step per full-width row on the sage sheet */}
      <Section tone="sage" id="deroulement">
        <SectionTitle light>Le déroulement</SectionTitle>
        <Lead light>Rien n’est confirmé automatiquement : chaque étape est validée par {settings.ownerFirstName}, et vous la suivez dans votre espace.</Lead>
        <ol className="mt-12 divide-y divide-sage-500/60 border-y border-sage-500/60">
          {STEPS.map((step) => (
            <li key={step.label} className="grid grid-cols-[96px_1fr] gap-4 py-7 md:grid-cols-[180px_1fr] md:gap-10 lg:grid-cols-[220px_1fr]">
              <p className="text-[15px] font-semibold text-clay-200">{step.label}</p>
              <div className="max-w-2xl">
                <h3 className="font-display text-[1.45rem] leading-tight text-ivory-50">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-sage-100">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Marie's approach */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <PortraitPlaceholder className="mx-auto w-full max-w-xs lg:mx-0" />
          <div>
            <SectionTitle>L’approche de {settings.ownerFirstName}</SectionTitle>
            <div className="prose-lpi mt-6">
              {approachParagraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            <Link href="/a-propos" className="specimen-link mt-6 inline-block text-[15px] font-semibold text-sage-800">
              Faire connaissance avec {settings.ownerFirstName}
            </Link>
          </div>
        </div>
      </Section>

      {/* Essential questions */}
      <Section tone="paper">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <SectionTitle>Les questions essentielles</SectionTitle>
            <Lead>Ce que les organisateurs nous demandent en premier. Les autres réponses sont dans la FAQ.</Lead>
            <Link href="/faq" className="specimen-link mt-6 inline-block text-[15px] font-semibold text-sage-800">
              Toutes les questions
            </Link>
          </div>
          <dl className="divide-y divide-sage-200 border-y border-sage-200">
            {essentialFaq.map((item) => (
              <div key={item.question} className="py-6">
                <dt className="font-sans text-lg font-semibold text-ink-900">{item.question}</dt>
                <dd className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Testimonials />
      <ClosingInvitation ownerFirstName={settings.ownerFirstName} />
    </>
  );
}
