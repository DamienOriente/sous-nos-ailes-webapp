import { chooseIntentAction } from "@/app/onboarding/actions";
import { KidsCornerScene } from "@/components/illustrations";
import { StorefrontScene } from "@/components/illustrations/app-scenes";
import { ORGANIZER_EXAMPLE_SUMMARY, PROFESSIONAL_EXAMPLE_SUMMARY } from "@/components/professionals/listing-examples";
import { DemoPhoto } from "@/components/shared/demo-photo";
import { SubmitButton } from "@/components/shared/submit-button";
import { cn } from "@/lib/utils";
import { showcasePhoto } from "@/modules/media/demo-photos";
import type { PrimaryIntent } from "@/modules/identity/domain/profile";

const OPTIONS: { intent: PrimaryIntent; title: string; description: string; bullets: string[]; cta: string; example: string; photo: ReturnType<typeof showcasePhoto>; Scene: typeof KidsCornerScene }[] = [
  {
    intent: "organizer",
    title: "Je prépare un évènement",
    description: "Mariage, baptême, anniversaire, séminaire. Invités, prestataires, budget et garde d'enfants au même endroit.",
    bullets: ["Un espace par évènement, partagé avec vos coorganisateurs", "Recherche et mise en relation avec des professionnels vérifiés", "Garde d'enfants avec suivi des présences et des personnes autorisées"],
    cta: "Créer mon évènement",
    example: ORGANIZER_EXAMPLE_SUMMARY,
    photo: showcasePhoto("intentOrganiser"),
    Scene: KidsCornerScene,
  },
  {
    intent: "professional",
    title: "Je propose mes services",
    description: "Garde d'enfants, animation, traiteur, lieu, photo, DJ. Présentez votre activité dans l'annuaire et recevez des demandes de contact et de devis.",
    bullets: ["Une fiche publique dans l'annuaire, modérée et vérifiable", "Demandes de contact et de devis dans une seule boîte", "Outils métier adaptés à votre spécialité"],
    cta: "Créer ma fiche pro",
    example: PROFESSIONAL_EXAMPLE_SUMMARY,
    photo: showcasePhoto("intentProfessional"),
    Scene: StorefrontScene,
  },
];

/** Two equivalent paths; the choice is remembered as `primaryIntent` but never restricts the account. */
export function IntentPicker({ current }: { current: PrimaryIntent | null }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {OPTIONS.map((option) => {
        const selected = current === option.intent;
        return (
          <article key={option.intent} className={cn("flex flex-col overflow-hidden rounded-3xl border bg-card shadow-soft", selected && "border-primary ring-1 ring-primary")} data-testid={`intent-${option.intent}`}>
            <div className="relative aspect-[16/8]">
              <DemoPhoto photo={option.photo} width={800} height={400} sizes="(max-width: 768px) 100vw, 480px" className="absolute inset-0" alt={`Photo d'ambiance de démonstration : ${option.title.toLowerCase()}`} priority />
              <option.Scene className="absolute bottom-0 right-3 w-36 sm:w-44" />
            </div>
            <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
              <div className="space-y-1.5">
                <h2 className="font-heading text-2xl leading-snug font-medium">{option.title}</h2>
                <p className="text-sm text-muted-foreground text-pretty">{option.description}</p>
              </div>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                {option.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground text-pretty">{option.example}</p>
              <form action={chooseIntentAction} className="mt-auto">
                <input type="hidden" name="intent" value={option.intent} />
                <SubmitButton className="w-full" pendingLabel="Un instant…">
                  {option.cta}
                </SubmitButton>
              </form>
            </div>
          </article>
        );
      })}
    </div>
  );
}
