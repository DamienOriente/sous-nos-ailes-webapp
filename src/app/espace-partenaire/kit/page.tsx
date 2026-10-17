import type { Metadata } from "next";
import { requirePartner } from "@/server/authz";
import { getPartnerPortal } from "@/server/services/venues";
import { getSettings } from "@/server/services/settings";
import { getEnv } from "@/lib/env";
import { qrCodeDataUrl } from "@/lib/qr";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const metadata: Metadata = { title: "Kit de présentation" };

/** One-page printable kit for the venue's welcome desk or brochure. */
export default async function PartnerKitPage() {
  const { user } = await requirePartner("/espace-partenaire/kit");
  const [{ venue, referralUrl }, settings] = await Promise.all([getPartnerPortal(user.id), getSettings()]);
  const env = getEnv();
  const qr = await qrCodeDataUrl(referralUrl);
  const owner = settings.ownerFirstName;
  return (
    <div className="flex flex-col gap-2">
      <PrintToolbar backHref="/espace-partenaire" backLabel="Retour à mon lieu" />
      <article className="mx-auto w-full max-w-3xl bg-white px-6 py-10 text-ink-900 shadow-card print:max-w-none print:px-0 print:py-0 print:shadow-none sm:px-12 sm:py-14">
        <header className="border-b border-sage-200 pb-6">
          <p className="font-display text-2xl text-sage-800">{settings.brandName}</p>
          <p className="mt-1 text-sm text-ink-500">En partenariat avec {venue.name}</p>
          {env.DEMO_MODE ? <p className="mt-4 rounded-sm border border-clay-200 bg-clay-100 px-3 py-2 text-[13px] text-clay-800">Kit de démonstration : données fictives.</p> : null}
        </header>

        <h1 className="mt-8 font-display text-[2rem] leading-tight">Organiser la garde des enfants dans ce lieu</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-700">{settings.tagline}</p>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-700">
          Pendant votre réception, une équipe coordonnée par {owner} s’occupe des enfants invités dans un espace prévu à cet effet ; vous décrivez votre événement une fois et {owner} vous transmet une proposition adaptée.
        </p>

        <div className="mt-10 grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL rendered for print; no optimisation applies. */}
          <img src={qr} alt={`QR code menant à ${referralUrl}`} width={240} height={240} className="size-60 rounded-sm border border-sage-200" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold tracking-[0.01em] text-ink-500">Décrire mon événement</p>
            <p className="mt-1 text-xl font-semibold break-all text-sage-800 tabular">{referralUrl}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-500">Scannez le code ou saisissez l’adresse. Votre demande est transmise à {owner}, qui vous répond personnellement.</p>
          </div>
        </div>

        <footer className="mt-10 border-t border-sage-200 pt-4 text-[13px] leading-relaxed text-ink-500">
          {settings.brandName} · {settings.contactEmail}
          {settings.contactPhone ? ` · ${settings.contactPhone}` : ""}. Aucune information nominative ou médicale concernant les enfants n’est collectée dans ce cadre.
        </footer>
      </article>
    </div>
  );
}
