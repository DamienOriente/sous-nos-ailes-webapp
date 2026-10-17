import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { authErrorMessage } from "@/modules/identity/domain/auth";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

/** better-auth validates the e-mailed token then redirects here with `?token=` (or `?error=INVALID_TOKEN`). */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  if (!token) {
    return (
      <AuthCard eyebrow="Assistance" title="Lien invalide" description="Ce lien de réinitialisation n'est pas valide ou a déjà été utilisé.">
        <div className="space-y-4">
          <FormMessage error={authErrorMessage(error ?? "INVALID_TOKEN")} />
          <Button asChild className="w-full">
            <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      eyebrow="Assistance"
      title="Choisir un nouveau mot de passe"
      description="Pour votre sécurité, toutes vos autres sessions seront déconnectées."
      footer={
        <p>
          <AuthLink href="/connexion">Retour à la connexion</AuthLink>
        </p>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
