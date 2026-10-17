import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuth, homePathForRole } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { getSettings } from "@/server/services/settings";
import { MagicLinkForm, PasswordForm } from "@/components/auth/login-form";
import { DemoBanner } from "@/components/shell/demo-banner";
import { LabelCard } from "@/components/ui/label-card";

export const metadata: Metadata = { title: "Connexion", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const auth = await getCurrentAuth();
  if (auth) redirect(homePathForRole(auth.user.role));
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const [settings, env] = await Promise.all([getSettings(), Promise.resolve(getEnv())]);
  return (
    <div className="flex min-h-dvh flex-col bg-ivory-100">
      <DemoBanner compact />
      <main className="container-page flex flex-1 flex-col items-center justify-center py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="font-display text-2xl text-sage-800">
            {settings.brandName}
          </Link>
          <h1 className="mt-6 font-display text-3xl">Accéder à mon espace</h1>
          <p className="mt-2 text-[15px] leading-snug text-ink-500">
            Clients, intervenant·es et partenaires reçoivent un lien de connexion par email. Aucun mot de passe à retenir.
          </p>
          <LabelCard className="mt-8" padding="lg">
            <MagicLinkForm />
          </LabelCard>
          {env.DEMO_MODE ? (
            <LabelCard className="mt-6" padding="lg" reference="Comptes de démonstration" title="Connexion par mot de passe (mode local uniquement)">
              <p className="mt-2 mb-4 text-sm leading-snug text-ink-500">
                Les identifiants de démonstration sont listés dans le README. Ils n’existent qu’en mode local et sont refusés en production.
              </p>
              <PasswordForm next={next} />
            </LabelCard>
          ) : null}
          <p className="mt-8 text-sm text-ink-500">
            <Link href="/" className="underline">
              Retour au site
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
