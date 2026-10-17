import Link from "next/link";
import { getSettings } from "@/server/services/settings";
import { getEnv } from "@/lib/env";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { DemoBanner } from "@/components/shell/demo-banner";
import { Sprig } from "@/components/illustrations/botanical";
import { buttonClasses } from "@/components/ui/button";

export default async function NotFound() {
  const settings = await getSettings();
  const env = getEnv();
  return (
    <>
      <DemoBanner compact />
      <SiteHeader brandName={settings.brandName} />
      <main id="contenu" className="flex-1">
        <div className="container-page flex flex-col items-start gap-6 py-24">
          <Sprig kind="fern" size={72} />
          <h1 className="font-display text-[2.5rem] leading-tight">Cette page n’existe pas</h1>
          <p className="max-w-lg text-[17px] leading-relaxed text-ink-700">L’adresse est peut-être erronée, ou la page a été retirée. Les prestations, les lieux partenaires et le formulaire de demande restent accessibles.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/" className={buttonClasses({ variant: "secondary" })}>
              Retour à l’accueil
            </Link>
            <Link href="/demander-un-devis" className={buttonClasses()}>
              Parler de mon événement
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter brandName={settings.brandName} tagline={settings.tagline} contactEmail={settings.contactEmail} areaLabel={settings.areaLabel} demo={env.DEMO_MODE} />
    </>
  );
}
