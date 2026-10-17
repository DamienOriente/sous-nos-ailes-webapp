import type { Metadata } from "next";
import { getSettings } from "@/server/services/settings";
import { buildMetadata, faqJsonLd } from "@/lib/seo";
import { FAQ_ITEMS } from "@/content/site";
import { PageIntro } from "@/components/public/page-intro";
import { Section } from "@/components/public/section";
import { ClosingInvitation } from "@/components/public/closing-invitation";
import { JsonLd } from "@/components/public/json-ld";

export const metadata: Metadata = buildMetadata({ title: "Questions fréquentes", description: "Âges accueillis, nombre d’intervenants, espace à prévoir, qualifications, données collectées, réservation, crédit d’impôt, zone d’intervention : les réponses des organisateurs.", path: "/faq" });

export default async function FaqPage() {
  const settings = await getSettings();
  return (
    <>
      <PageIntro title="Questions fréquentes" lead="Les réponses que nous donnons le plus souvent aux organisateurs. Pour tout le reste, écrivez-nous." crumbs={[{ name: "FAQ", path: "/faq" }]} sprig="gypsophila" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <dl className="mx-auto max-w-3xl divide-y divide-sage-200 border-y border-sage-200">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="py-7">
              <dt className="font-display text-[1.35rem] leading-snug text-ink-900">{item.question}</dt>
              <dd className="mt-3 text-[15px] leading-relaxed text-ink-700">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <ClosingInvitation ownerFirstName={settings.ownerFirstName} />
      <JsonLd data={faqJsonLd(FAQ_ITEMS.map((item) => ({ question: item.question, answer: item.answer })))} />
    </>
  );
}
