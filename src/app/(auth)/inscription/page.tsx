import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getActor } from "@/lib/session";
import { safeNextPath } from "@/modules/identity/domain/auth";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const actor = await getActor();
  if (actor) redirect(safeNextPath(params.next));
  const next = params.next ? safeNextPath(params.next) : null;

  return (
    <AuthCard
      eyebrow="Bienvenue"
      title="Créer votre compte"
      description="Un seul compte pour organiser vos évènements ou proposer vos services. Gratuit, sans engagement."
      footer={
        <p>
          Déjà inscrit ? <AuthLink href={next ? `/connexion?next=${encodeURIComponent(next)}` : "/connexion"}>Se connecter</AuthLink>
        </p>
      }
    >
      <SignUpForm next={next} />
    </AuthCard>
  );
}
