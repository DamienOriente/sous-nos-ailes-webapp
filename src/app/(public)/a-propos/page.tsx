import type { Metadata } from "next";
import Link from "next/link";
import { getContent, getSettings, paragraphsOf } from "@/server/services/settings";
import { buildMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/public/page-intro";
import { Section, SectionTitle } from "@/components/public/section";
import { ClosingInvitation } from "@/components/public/closing-invitation";
import { PortraitPlaceholder } from "@/components/illustrations/botanical";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({ title: `À propos de ${settings.ownerFirstName}`, description: `Qui est ${settings.ownerFirstName}, professionnelle de la petite enfance, et pourquoi elle propose la garde d’enfants lors de mariages et d’événements.`, path: "/a-propos" });
}

export default async function AboutPage() {
  const [settings, about] = await Promise.all([getSettings(), getContent("about.marie")]);
  const paragraphs = paragraphsOf(about.body);
  return (
    <>
      <PageIntro title={`À propos de ${settings.ownerFirstName}`} lead="Une professionnelle de la petite enfance, un réseau de personnes choisies, une seule interlocutrice." crumbs={[{ name: "À propos", path: "/a-propos" }]} sprig="gypsophila" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <div className="grid gap-10 lg:grid-cols-[2fr_3fr] lg:gap-16">
          <PortraitPlaceholder className="mx-auto w-full max-w-sm lg:mx-0" />
          <div className="prose-lpi">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      </Section>
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionTitle>Ce que {settings.ownerFirstName} promet</SectionTitle>
            <ul className="mt-6 grid gap-3 text-[15px] leading-relaxed text-ink-700">
              <li className="border-l border-sage-300 pl-4">Étudier personnellement chaque demande et dire franchement ce qui est possible.</li>
              <li className="border-l border-sage-300 pl-4">Ne confier une mission qu’à des personnes qu’elle connaît et a rencontrées.</li>
              <li className="border-l border-sage-300 pl-4">Rester joignable avant et pendant la prestation.</li>
              <li className="border-l border-sage-300 pl-4">Ne jamais collecter de données sur les enfants au-delà de leur nombre par âge.</li>
            </ul>
          </div>
          <div>
            <SectionTitle>Ce qu’elle ne prétend pas</SectionTitle>
            <ul className="mt-6 grid gap-3 text-[15px] leading-relaxed text-ink-700">
              <li className="border-l border-clay-300 pl-4">Être une crèche, une structure agréée ou un réseau certifié.</li>
              <li className="border-l border-clay-300 pl-4">Garantir une disponibilité avant d’avoir constitué l’équipe.</li>
              <li className="border-l border-clay-300 pl-4">Afficher des avis, des chiffres ou des partenaires qui n’existent pas encore.</li>
            </ul>
            <p className="mt-6 text-[15px] leading-relaxed text-ink-500">
              Le fonctionnement complet est décrit dans{" "}
              <Link href="/organisation" className="underline">
                Notre organisation
              </Link>
              .
            </p>
          </div>
        </div>
      </Section>
      <ClosingInvitation ownerFirstName={settings.ownerFirstName} />
    </>
  );
}
