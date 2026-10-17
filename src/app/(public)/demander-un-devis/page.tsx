import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getSettings, listActiveOptions } from "@/server/services/settings";
import { listPublishedVenues, resolveReferralCode } from "@/server/services/venues";
import { buildMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/public/page-intro";
import { Section } from "@/components/public/section";
import { QuoteRequestForm } from "@/components/public/quote-request-form";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = buildMetadata({ title: "Demander une proposition", description: "Décrivez votre événement en cinq minutes : date, lieu, nombre d’enfants par âge. Marie vous rappelle et vous transmet une proposition. Sans engagement.", path: "/demander-un-devis" });

export default async function RequestPage({ searchParams }: PageProps<"/demander-un-devis">) {
  const params = await searchParams;
  const [settings, venues, options, store] = await Promise.all([getSettings(), listPublishedVenues(), listActiveOptions(), cookies()]);
  const lieu = typeof params.lieu === "string" ? params.lieu : null;
  const preselected = lieu ? venues.find((v) => v.slug === lieu) ?? null : null;
  const referralCookie = store.get("lpi_ref")?.value ?? null;
  const referral = referralCookie ? await resolveReferralCode(decodeURIComponent(referralCookie).split(".")[0]) : null;
  return (
    <>
      <PageIntro title="Parler de mon événement" lead={`Cinq minutes suffisent. ${settings.ownerFirstName} étudie votre demande, vous rappelle et vous transmet une proposition. Rien n’est réservé tant que vous n’avez pas donné votre accord.`} crumbs={[{ name: "Demander une proposition", path: "/demander-un-devis" }]} sprig="gypsophila" />
      <Section tone="paper" className="pt-4 sm:pt-8">
        <div className="grid gap-10 lg:grid-cols-[3fr_1fr] lg:gap-16">
          <div className="plate p-6 sm:p-8">
            {referral ? (
              <Alert kind="info" className="mb-6">
                Vous arrivez de la part de <strong>{referral.name}</strong>. Nous le noterons dans votre demande.
              </Alert>
            ) : null}
            <QuoteRequestForm venues={venues.map((v) => ({ id: v.id, name: v.name, city: v.city, slug: v.slug }))} options={options.map((o) => ({ code: o.code, label: o.label, description: o.description }))} preselectedVenue={preselected ? { id: preselected.id, name: preselected.name, city: preselected.city, slug: preselected.slug } : null} referralCode={referral?.referralCode ?? null} />
          </div>
          <aside className="flex flex-col gap-6 text-[15px] leading-relaxed text-ink-700">
            <div>
              <h2 className="font-sans text-lg font-semibold text-ink-900">Ce qui se passe ensuite</h2>
              <p className="mt-2">Vous recevez un accusé de réception avec une référence, puis {settings.ownerFirstName} vous rappelle pour préciser les détails.</p>
            </div>
            <div>
              <h2 className="font-sans text-lg font-semibold text-ink-900">Vos données</h2>
              <p className="mt-2">Elles servent uniquement à étudier et préparer votre demande. Nous ne collectons rien sur les enfants au-delà de leur nombre par âge.</p>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
