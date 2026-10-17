import type { Metadata } from "next";
import Link from "next/link";
import { IntentPicker } from "@/components/identity/intent-picker";
import { FormMessage } from "@/components/shared/form-message";
import { requireActor } from "@/lib/session";
import { getProfile } from "@/modules/identity/application/profile-service";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const [{ erreur }, actor] = await Promise.all([searchParams, requireActor("/onboarding")]);
  const profile = await getProfile(actor);
  const firstName = profile.firstName || actor.name.split(" ")[0] || "";

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Bienvenue{firstName ? `, ${firstName}` : ""}</p>
        <h1 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Que souhaitez-vous faire en premier ?</h1>
        <p className="mx-auto max-w-xl text-muted-foreground text-pretty">Vous pourrez faire les deux plus tard : un même compte peut organiser des évènements et proposer des services.</p>
      </header>
      {erreur && <FormMessage error="Choix non reconnu. Sélectionnez l'un des deux parcours." />}
      <IntentPicker current={profile.primaryIntent} />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/app" className="font-medium text-primary underline-offset-4 hover:underline">
          Explorer mon espace sans choisir maintenant
        </Link>
      </p>
    </div>
  );
}
