import type { Metadata } from "next";
import { getSettings } from "@/server/services/settings";
import { buildMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/public/page-intro";
import { Section } from "@/components/public/section";
import { ContactForm } from "@/components/public/forms";
import { LabelCard } from "@/components/ui/label-card";

export const metadata: Metadata = buildMetadata({ title: "Contact", description: "Une question avant de décrire votre événement ? Écrivez à Marie : elle répond personnellement.", path: "/contact" });

export default async function ContactPage() {
  const settings = await getSettings();
  return (
    <>
      <PageIntro title="Contact" lead={`Une question, un cas particulier, un lieu à nous présenter ? ${settings.ownerFirstName} répond personnellement.`} crumbs={[{ name: "Contact", path: "/contact" }]} sprig="sage" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <div className="grid gap-10 lg:grid-cols-[3fr_2fr] lg:gap-16">
          <div className="plate p-6 sm:p-8">
            <ContactForm />
          </div>
          <div className="flex flex-col gap-6">
            <LabelCard title="Par email">
              <p className="mt-2 text-[15px] text-ink-700">
                <a href={`mailto:${settings.contactEmail}`} className="underline">
                  {settings.contactEmail}
                </a>
              </p>
              {settings.contactPhone ? <p className="mt-1 text-[15px] text-ink-700">{settings.contactPhone}</p> : null}
            </LabelCard>
            <LabelCard title="Zone d’intervention">
              <p className="mt-2 text-[15px] leading-relaxed text-ink-700">{settings.areaLabel}</p>
            </LabelCard>
            <LabelCard title="Pour décrire un événement">
              <p className="mt-2 text-[15px] leading-relaxed text-ink-700">Le formulaire guidé est plus rapide qu’un email : date, lieu, effectifs par âge, et {settings.ownerFirstName} vous rappelle.</p>
              <a href="/demander-un-devis" className="specimen-link mt-3 inline-block text-[15px] font-semibold text-sage-800">
                Parler de mon événement
              </a>
            </LabelCard>
          </div>
        </div>
      </Section>
    </>
  );
}
