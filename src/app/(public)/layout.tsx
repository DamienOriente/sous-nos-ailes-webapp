import type { ReactNode } from "react";
import { getEnv } from "@/lib/env";
import { getSettings } from "@/server/services/settings";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { DemoBanner } from "@/components/shell/demo-banner";
import { JsonLd } from "@/components/public/json-ld";
import { organizationJsonLd } from "@/lib/seo";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  const env = getEnv();
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-ivory-50 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-sage-800 focus:shadow-card">
        Aller au contenu
      </a>
      <DemoBanner compact />
      <SiteHeader brandName={settings.brandName} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter brandName={settings.brandName} tagline={settings.tagline} contactEmail={settings.contactEmail} areaLabel={settings.areaLabel} demo={env.DEMO_MODE} />
      <JsonLd data={organizationJsonLd(settings)} />
    </>
  );
}
