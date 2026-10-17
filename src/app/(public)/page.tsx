import type { Metadata } from "next";
import { Categories, Cities, Faq, FinalCta, Hero, HOME_FAQ, HowItWorks, PricingSummary, Tools, Trust, ValueProposition } from "@/components/marketing/home-sections";
import { env, isDemo } from "@/lib/env";
import { getActiveCategories, getPublicCounters } from "@/modules/analytics/application/public-counters";

export const metadata: Metadata = {
  title: { absolute: "Sous Nos Ailes — Garde d'enfants et professionnels pour vos évènements" },
  description: "Trouvez des professionnels vérifiés de la garde d'enfants, de l'animation et de l'évènementiel, puis coordonnez toute votre équipe depuis un seul espace. Gratuit pour commencer.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Sous Nos Ailes",
    title: "Sous Nos Ailes — Garde d'enfants et professionnels pour vos évènements",
    description: "Les enfants sont pris en charge. Vous pouvez profiter de la fête.",
  },
};

function structuredData() {
  const base = env.APP_URL;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Sous Nos Ailes",
      url: base,
      logo: `${base}/icon.svg`,
      description: "Plateforme de mise en relation et de coordination pour évènements privés et professionnels, spécialisée garde d'enfants et animation.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Sous Nos Ailes",
      url: base,
      inLanguage: "fr-FR",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${base}/annuaire?city={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: HOME_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
}

export default async function HomePage() {
  const [categories, counters] = await Promise.all([getActiveCategories(), getPublicCounters()]);
  return (
    <>
      {/* JSON-LD is a data block, not executable: CSP does not apply to it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }} />
      <Hero categories={categories} counters={counters} isDemo={isDemo} />
      <ValueProposition />
      <HowItWorks />
      <Categories categories={categories} />
      <Trust />
      <Tools />
      <Cities cities={counters.cities} isDemo={isDemo} />
      <PricingSummary />
      <Faq />
      <FinalCta />
    </>
  );
}
