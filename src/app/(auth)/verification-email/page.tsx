import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MailOpen } from "lucide-react";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { ConfettiScene } from "@/components/illustrations";
import { ResendVerification } from "@/components/auth/resend-verification";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { getActor } from "@/lib/session";
import { authErrorMessage } from "@/modules/identity/domain/auth";

export const metadata: Metadata = { title: "Confirmation de l'adresse e-mail" };

/**
 * Three states: just signed up (waiting), came back from the e-mail link
 * successfully (`?statut=ok`, better-auth handled /api/auth/verify-email and
 * signed the user in), or the link failed (`?error=`).
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ statut?: string; error?: string }> }) {
  const { statut, error } = await searchParams;
  const actor = await getActor();

  if (statut === "ok" || (actor?.emailVerified && !error)) {
    return (
      <AuthCard eyebrow="C'est confirmé" title="Adresse e-mail vérifiée" description="Merci ! Votre compte est maintenant pleinement actif.">
        <div className="space-y-4">
          <ConfettiScene className="mx-auto -mt-4 w-48" />
          <div className="flex items-center gap-3 rounded-xl bg-success/15 p-4 text-sm" role="status">
            <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
            <p>Vous recevrez désormais vos notifications par e-mail selon vos préférences.</p>
          </div>
          <Button asChild className="w-full">
            <Link href={actor ? "/app" : "/connexion"}>{actor ? "Accéder à mon espace" : "Se connecter"}</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (error) {
    return (
      <AuthCard eyebrow="Oups" title="Lien de confirmation invalide" description="Le lien a expiré ou a déjà été utilisé. Demandez un nouvel e-mail ci-dessous.">
        <div className="space-y-4">
          <FormMessage error={authErrorMessage(error)} />
          <ResendVerification email={actor?.email} />
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Encore une étape"
      title="Confirmez votre adresse e-mail"
      description={actor ? `Nous avons envoyé un lien de confirmation à ${actor.email}. Cliquez dessus pour activer toutes les fonctionnalités de votre compte.` : "Nous vous avons envoyé un lien de confirmation. Cliquez dessus pour activer votre compte."}
      footer={
        <p>
          Adresse erronée ? <AuthLink href="/app/compte">Modifier mon profil</AuthLink>
        </p>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-accent/60 p-4 text-sm text-accent-foreground">
          <MailOpen className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>Le lien est valable 24 heures. Si vous ne voyez rien arriver, vérifiez vos courriers indésirables, puis renvoyez l'e-mail.</p>
        </div>
        <ResendVerification email={actor?.email} />
        {actor && (
          <Button asChild variant="ghost" className="w-full">
            <Link href="/onboarding">Continuer sans attendre</Link>
          </Button>
        )}
      </div>
    </AuthCard>
  );
}
