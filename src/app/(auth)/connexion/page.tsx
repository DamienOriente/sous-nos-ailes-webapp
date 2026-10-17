import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthLink, AuthPanel, AuthSplit } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { WingsScene } from "@/components/illustrations";
import { getActor } from "@/lib/session";
import { eventPhoto } from "@/modules/media/demo-photos";
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
  const celebrate = params.message === "mot-de-passe-reinitialise";

  return (
    <AuthSplit
      panel={
        <AuthPanel
          photo={eventPhoto("wedding", 6)}
          scene={<WingsScene />}
          promise="Vos évènements, vos fiches et vos échanges au même endroit."
          benefits={["Retrouvez chaque évènement avec son équipe, son budget et ses invités", "Suivez les demandes reçues sur vos fiches professionnelles", "Une garde d'enfants coordonnée, du brief à la remise aux parents"]}
          caption="Photo d'ambiance de démonstration."
        />
      }
    >
      <AuthCard
        flat
        eyebrow={celebrate ? "C'est fait" : "Bon retour"}
        title={celebrate ? "Nouveau mot de passe enregistré" : "Connexion à votre espace"}
        description={celebrate ? "Vos autres sessions ont été fermées. Connectez-vous avec votre nouveau mot de passe." : "Retrouvez vos évènements, vos fiches professionnelles et vos échanges."}
        footer={
          <p>
            Pas encore de compte ? <AuthLink href={params.next ? `/inscription?next=${encodeURIComponent(next)}` : "/inscription"}>Créer un compte</AuthLink>
          </p>
        }
      >
        {celebrate && <WingsScene className="mx-auto -mt-2 mb-2 w-40" />}
        <SignInForm next={next} notice={notice} />
      </AuthCard>
    </AuthSplit>
  );
}
