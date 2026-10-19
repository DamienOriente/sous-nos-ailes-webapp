import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Indiquez l'adresse de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe."
      footer={
        <p>
          <AuthLink href="/connexion">Retour à la connexion</AuthLink>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
