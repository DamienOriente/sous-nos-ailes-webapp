import type { Metadata } from "next";
import { getSettings } from "@/server/services/settings";
import { ConsumeLinkForm } from "@/components/auth/consume-link-form";
import { DemoBanner } from "@/components/shell/demo-banner";
import { LabelCard } from "@/components/ui/label-card";

export const metadata: Metadata = { title: "Confirmer la connexion", robots: { index: false, follow: false } };

// The link is consumed by a POST (Server Action), not by the GET that renders
// this page, so an email scanner prefetching the URL cannot burn the token.
export default async function ConsumeLinkPage({ params }: PageProps<"/connexion/lien/[token]">) {
  const { token } = await params;
  const settings = await getSettings();
  return (
    <div className="flex min-h-dvh flex-col bg-ivory-100">
      <DemoBanner compact />
      <main className="container-page flex flex-1 flex-col items-center justify-center py-12">
        <div className="w-full max-w-md">
          <p className="font-display text-2xl text-sage-800">{settings.brandName}</p>
          <h1 className="mt-6 font-display text-3xl">Confirmer la connexion</h1>
          <p className="mt-2 text-[15px] leading-snug text-ink-500">Cliquez pour ouvrir votre espace. Ce lien ne fonctionne qu’une fois.</p>
          <LabelCard className="mt-8" padding="lg">
            <ConsumeLinkForm token={token} />
          </LabelCard>
        </div>
      </main>
    </div>
  );
}
