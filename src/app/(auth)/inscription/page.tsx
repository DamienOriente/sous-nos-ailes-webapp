import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthLink, AuthPanel, AuthSplit } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { KidsCornerScene } from "@/components/illustrations";
import { getActor } from "@/lib/session";
import { demoPhoto } from "@/modules/media/demo-photos";
import { safeNextPath } from "@/modules/identity/domain/auth";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const actor = await getActor();
  if (actor) redirect(safeNextPath(params.next));
  const next = params.next ? safeNextPath(params.next) : null;

  return (
    <AuthSplit
      panel={
        <AuthPanel
          photo={demoPhoto("kids", 8)}
          scene={<KidsCornerScene />}
          promise="Des évènements où les enfants ont leur place, et les parents leur soirée."
          benefits={["Gratuit : un espace par évènement, l'annuaire et les demandes de devis sans engagement", "Un seul compte pour organiser et pour proposer vos services", "Exemple pour commencer : le mariage de Louis et Lisa, 90 invités dont 12 enfants"]}
          caption="Photo d'ambiance de démonstration."
        />
      }
    >
      <AuthCard
        flat
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
    </AuthSplit>
  );
}
