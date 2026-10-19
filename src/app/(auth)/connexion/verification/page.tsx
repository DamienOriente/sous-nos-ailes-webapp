import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { TwoFactorVerifyForm } from "@/components/auth/two-factor-verify-form";
import { getActor } from "@/lib/session";

export const metadata: Metadata = { title: "Vérification en deux étapes" };

/** Reached after a password sign-in on a 2FA account (better-auth sets a short-lived two-factor cookie). */
export default async function TwoFactorPage() {
  const actor = await getActor();
  if (actor) redirect("/app");
  return (
    <AuthCard
      title="Vérification en deux étapes"
      description="Votre compte est protégé par la double authentification. Saisissez le code généré par votre application."
      footer={
        <p>
          Vous n'avez plus accès à votre application ni à vos codes de secours ? <AuthLink href="/contact">Contactez le support</AuthLink>. Ou <AuthLink href="/connexion">revenir à la connexion</AuthLink>.
        </p>
      }
    >
      <TwoFactorVerifyForm />
    </AuthCard>
  );
}
