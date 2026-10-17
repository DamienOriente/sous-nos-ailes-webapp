import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVenueForAdmin, referralUrlFor } from "@/server/services/venues";
import { getSettings } from "@/server/services/settings";
import { getEnv } from "@/lib/env";
import { qrCodeDataUrl } from "@/lib/qr";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const metadata: Metadata = { title: "Kit partenaire" };

/** Printable one-page kit for the venue: pitch, referral link and QR code. No personal data. */
export default async function VenueKitPage({ params }: PageProps<"/admin/lieux/[id]/kit">) {
  const { id } = await params;
  const [venue, settings] = await Promise.all([getVenueForAdmin(id), getSettings()]);
  if (!venue) notFound();
  const env = getEnv();
  const referralUrl = referralUrlFor(venue.referralCode);
  const qr = await qrCodeDataUrl(referralUrl, 360);
  return (
    <div className="-mt-2">
      <PrintToolbar backHref={`/admin/lieux/${id}`} backLabel="Retour au lieu" />
      <article className="mx-auto w-full max-w-3xl bg-white px-6 py-10 text-ink-900 shadow-card print:max-w-none print:px-0 print:py-0 print:shadow-none sm:px-12 sm:py-14">
        <header className="border-b border-sage-200 pb-6">
          <p className="font-display text-2xl text-sage-800">{settings.brandName}</p>
          <p className="mt-1 text-sm text-ink-500">{settings.tagline}</p>
          {env.DEMO_MODE || venue.isDemo ? <p className="mt-4 rounded-sm border border-clay-200 bg-clay-100 px-3 py-2 text-[13px] text-clay-800">Kit de démonstration : lieu et adresse fictifs.</p> : null}
        </header>
        <section className="mt-8 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <h1 className="font-display text-[1.75rem] leading-tight">Les enfants ont leur place à {venue.name}</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-700">{venue.summary}</p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-700">
              Pendant un mariage, une fête ou un événement professionnel organisé ici, {settings.ownerFirstName} et son équipe prennent soin des enfants dans un espace à eux, avec des activités adaptées à leur âge. Les organisateurs profitent du moment ; les enfants aussi.
            </p>
            <div className="mt-6 rounded-md border border-sage-200 bg-ivory-50 px-4 py-3">
              <p className="text-[13px] font-semibold text-ink-500">Pour demander un devis</p>
              <p className="mt-1 break-all text-[15px] font-semibold text-sage-800 tabular">{referralUrl}</p>
              <p className="mt-1 text-[13px] text-ink-500">Ce lien indique que la demande vient de {venue.name}.</p>
            </div>
          </div>
          <figure className="mx-auto flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated server-side, no optimisation possible */}
            <img src={qr} alt={`QR code vers ${referralUrl}`} width={220} height={220} className="rounded-md border border-sage-200" />
            <figcaption className="text-[13px] text-ink-500">Scanner pour faire une demande</figcaption>
          </figure>
        </section>
        <footer className="mt-10 border-t border-sage-200 pt-4 text-[13px] leading-relaxed text-ink-500">
          <p>
            Contact : {settings.ownerFirstName} · {settings.contactEmail}
            {settings.contactPhone ? ` · ${settings.contactPhone}` : ""} · {settings.areaLabel}
          </p>
          <p className="mt-1">Aucune information nominative sur les enfants n’est demandée. Chaque prestation est confirmée par {settings.ownerFirstName} une fois l’équipe constituée.</p>
        </footer>
      </article>
    </div>
  );
}
