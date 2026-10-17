import { ArrowRight, PartyPopper, Store } from "lucide-react";
import { chooseIntentAction } from "@/app/onboarding/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import type { PrimaryIntent } from "@/modules/identity/domain/profile";

const OPTIONS: { intent: PrimaryIntent; icon: typeof PartyPopper; title: string; description: string; bullets: string[]; cta: string }[] = [
  {
    intent: "organizer",
    icon: PartyPopper,
    title: "Je prépare un évènement",
    description: "Mariage, baptême, anniversaire, séminaire… Centralisez invités, prestataires, budget et garde d'enfants.",
    bullets: ["Un espace par évènement, partagé avec vos coorganisateurs", "Recherche et mise en relation avec des professionnels vérifiés", "Garde d'enfants coordonnée en toute sécurité"],
    cta: "Créer mon évènement",
  },
  {
    intent: "professional",
    icon: Store,
    title: "Je propose mes services",
    description: "Garde d'enfants, animation, traiteur, lieu, photo, DJ… Présentez votre activité et recevez des demandes qualifiées.",
    bullets: ["Une fiche publique dans l'annuaire, modérée et vérifiable", "Demandes de contact et de devis centralisées", "Outils métier adaptés à votre spécialité"],
    cta: "Créer ma fiche pro",
  },
];

/** Two equivalent paths; the choice is remembered as `primaryIntent` but never restricts the account. */
export function IntentPicker({ current }: { current: PrimaryIntent | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = current === option.intent;
        return (
          <Card key={option.intent} className={selected ? "border-primary/50 ring-2 ring-primary/20" : undefined}>
            <CardHeader>
              <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h2 className="font-heading text-xl leading-snug font-medium">{option.title}</h2>
              <CardDescription className="text-pretty">{option.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-5">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {option.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <form action={chooseIntentAction} className="mt-auto">
                <input type="hidden" name="intent" value={option.intent} />
                <SubmitButton className="w-full" pendingLabel="Un instant…">
                  {option.cta}
                  <ArrowRight aria-hidden="true" />
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
