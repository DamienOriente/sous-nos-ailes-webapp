import { ArrowRight, PartyPopper, Store } from "lucide-react";
import { chooseIntentAction } from "@/app/onboarding/actions";
import { KidsCornerScene } from "@/components/illustrations";
import { StorefrontScene } from "@/components/illustrations/app-scenes";
import { ORGANIZER_EXAMPLE_SUMMARY, PROFESSIONAL_EXAMPLE_SUMMARY } from "@/components/professionals/listing-examples";
import { DemoPhoto } from "@/components/shared/demo-photo";
import { SubmitButton } from "@/components/shared/submit-button";
import { cn } from "@/lib/utils";
import { categoryPhoto, eventPhoto } from "@/modules/media/demo-photos";
import type { PrimaryIntent } from "@/modules/identity/domain/profile";

const OPTIONS: { intent: PrimaryIntent; icon: typeof PartyPopper; title: string; description: string; bullets: string[]; cta: string; example: string; photo: ReturnType<typeof eventPhoto>; Scene: typeof KidsCornerScene; tone: string }[] = [
  {
    intent: "organizer",
    icon: PartyPopper,
    title: "Je prépare un évènement",
    description: "Mariage, baptême, anniversaire, séminaire… Centralisez invités, prestataires, budget et garde d'enfants.",
    bullets: ["Un espace par évènement, partagé avec vos coorganisateurs", "Recherche et mise en relation avec des professionnels vérifiés", "Garde d'enfants coordonnée en toute sécurité"],
    cta: "Créer mon évènement",
    example: ORGANIZER_EXAMPLE_SUMMARY,
    photo: eventPhoto("wedding", 3),
    Scene: KidsCornerScene,
    tone: "from-blush/80",
  },
  {
    intent: "professional",
    icon: Store,
    title: "Je propose mes services",
    description: "Garde d'enfants, animation, traiteur, lieu, photo, DJ… Présentez votre activité et recevez des demandes qualifiées.",
    bullets: ["Une fiche publique dans l'annuaire, modérée et vérifiable", "Demandes de contact et de devis centralisées", "Outils métier adaptés à votre spécialité"],
    cta: "Créer ma fiche pro",
    example: PROFESSIONAL_EXAMPLE_SUMMARY,
    photo: categoryPhoto("garde-enfants-evenementielle", 1),
    Scene: StorefrontScene,
    tone: "from-sage-soft",
  },
];

/** Two equivalent paths; the choice is remembered as `primaryIntent` but never restricts the account. */
export function IntentPicker({ current }: { current: PrimaryIntent | null }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = current === option.intent;
        return (
          <article key={option.intent} className={cn("flex flex-col overflow-hidden rounded-3xl border bg-card shadow-soft", selected && "border-primary/50 ring-2 ring-primary/20")} data-testid={`intent-${option.intent}`}>
            <div className="relative aspect-[16/8]">
              <DemoPhoto photo={option.photo} width={800} height={400} sizes="(max-width: 768px) 100vw, 480px" className="absolute inset-0" alt={`Photo d'ambiance de démonstration : ${option.title.toLowerCase()}`} priority />
              <div className={cn("absolute inset-0 bg-gradient-to-t to-transparent", option.tone)} aria-hidden="true" />
              <option.Scene className="absolute bottom-0 right-3 w-36 drop-shadow-sm sm:w-44" />
              <span className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-xl bg-card/90 text-primary shadow-soft">
                <Icon className="size-5" aria-hidden="true" />
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
              <div className="space-y-1.5">
                <h2 className="font-heading text-2xl leading-snug font-medium">{option.title}</h2>
                <p className="text-sm text-muted-foreground text-pretty">{option.description}</p>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {option.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground text-pretty">{option.example}</p>
              <form action={chooseIntentAction} className="mt-auto">
                <input type="hidden" name="intent" value={option.intent} />
                <SubmitButton className="w-full" pendingLabel="Un instant…">
                  {option.cta}
                  <ArrowRight aria-hidden="true" />
                </SubmitButton>
              </form>
            </div>
          </article>
        );
      })}
    </div>
  );
}
