import { DemoBanner } from "@/components/shared/demo-banner";
import { CookieBannerSlot } from "@/app/(public)/cookie-banner-slot";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <SiteHeader />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <CookieBannerSlot />
    </div>
  );
}
