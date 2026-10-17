import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getActor } from "@/lib/session";
import { safeNextPath } from "@/modules/identity/domain/auth";

export const metadata: Metadata = { title: "Connexion" };

const NOTICES: Record<string, string> = {
  "mot-de-passe-reinitialise": "Votre mot de passe a été réinitialisé. Connectez-vous avec le nouveau.",
  deconnecte: "Vous êtes déconnecté.",
  "session-expiree": "Votre session a expiré. Reconnectez-vous pour continuer.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const actor = await getActor();
  if (actor) redirect(next);
  const notice = params.message ? NOTICES[params.message] ?? null : null;

  return (
    <AuthCard
      eyebrow="Bon retour"
      title="Connexion à votre espace"
      description="Retrouvez vos évènements, vos fiches professionnelles et vos échanges."
      footer={
        <p>
          Pas encore de compte ? <AuthLink href={params.next ? `/inscription?next=${encodeURIComponent(next)}` : "/inscription"}>Créer un compte</AuthLink>
        </p>
      }
    >
      <SignInForm next={next} notice={notice} />
    </AuthCard>
  );
}
