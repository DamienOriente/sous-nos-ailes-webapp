import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StepGlyph } from "@/components/marketing/illustrations";
import { Container, Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Organiser un évènement",
  description: "Le parcours d'un organisateur sur Sous Nos Ailes : trouver les professionnels, réunir l'équipe, préparer et vivre le jour J, enfants compris.",
  alternates: { canonical: "/organiser" },
};

const JOURNEY: Array<{ step: 1 | 2 | 3; title: string; items: string[] }> = [
  {
    step: 1,
    title: "Avant : trouver et comparer",
    items: [
      "Cherchez par métier et par zone dans l'annuaire ; la garde d'enfants est en tête, les autres métiers suivent.",
      "Chaque fiche indique ce qui a été vérifié, le périmètre d'intervention et une fourchette de prix quand le professionnel l'a renseignée.",
      "Envoyez une demande de contact, de disponibilité ou de devis. Les réponses arrivent dans votre espace et par e-mail.",
    ],
  },
  {
    step: 2,
    title: "Pendant la préparation : réunir l'équipe",
    items: [
      "Créez l'évènement (mariage, baptême, anniversaire, séminaire…) : une liste de tâches adaptée au type d'évènement est proposée.",
      "Invitez coorganisateurs, wedding planner et prestataires avec un lien sécurisé. Chacun obtient un rôle et ne voit que ce qui le concerne.",
      "Suivez le budget, les devis et les documents ; échangez dans des canaux par sujet ; partagez le planning du jour J.",
      "Si des enfants sont présents, inscrivez-les avec les consignes des parents : l'équipe de garde disposera d'un espace dédié et sécurisé.",
    ],
  },
  {
    step: 3,
    title: "Le jour J : vivre la fête",
    items: [
      "Accueillez les invités au QR code (gratuit en version simple, personnalisé avec l'offre Plus) et suivez les présences.",
      "L'équipe de garde enregistre arrivées, départs et remises aux personnes autorisées ; vous avez la vue d'ensemble.",
      "Après l'évènement, archivez : les données des enfants sont anonymisées automatiquement.",
    ],
  },
];

export default function OrganizerPage() {
  return (
    <>
      <Section className="pb-8">
        <Container>
          <p className="text-base text-muted-foreground">Pour les organisateurs</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-semibold text-balance sm:text-5xl">Préparer un évènement sans tout porter seul</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground text-pretty">
            Sous Nos Ailes réunit vos professionnels, votre équipe et vos invités au même endroit. Voici concrètement ce qui se passe, de la première recherche au lendemain de la fête.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-5">
              <Link href="/inscription?intent=organizer">Créer mon espace gratuitement</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-5">
              <Link href="/annuaire/garde-enfants-evenementielle">Voir les professionnels de la garde d'enfants</Link>
            </Button>
          </div>
        </Container>
      </Section>
      <Section className="pt-8">
        <Container>
          <ol className="space-y-12">
            {JOURNEY.map((j) => (
              <li key={j.step} className="grid gap-5 sm:grid-cols-[72px_1fr]">
                <StepGlyph step={j.step} />
                <div>
                  <h2 className="text-2xl font-semibold">{j.title}</h2>
                  <ul className="mt-4 space-y-3 leading-7 text-muted-foreground">
                    {j.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-3 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        <span className="text-pretty">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>
      <Section className="bg-ivory-deep/60 dark:bg-ivory-deep/40">
        <Container className="grid gap-8 md:grid-cols-3">
          <div>
            <h2 className="text-xl font-semibold">Ce qui est gratuit</h2>
            <p className="mt-2 leading-7 text-muted-foreground text-pretty">Jusqu'à trois évènements, l'annuaire, les demandes, les tâches, le planning, 50 contacts et 60 invitations essentielles.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Ce qu'ajoute Organisateur Plus</h2>
            <p className="mt-2 leading-7 text-muted-foreground text-pretty">Plan de table, invitations personnalisées et QR codes, budget avancé, exports PDF et CSV, collaboration étendue. 9,90 € TTC par mois, sans engagement.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Ce qui reste entre vous et vos prestataires</h2>
            <p className="mt-2 leading-7 text-muted-foreground text-pretty">Le contrat, le prix et le paiement de chaque prestation. Nous ne sommes ni intermédiaire de paiement ni employeur.</p>
          </div>
          <Link href="/tarifs" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline md:col-span-3">
            Comparer les offres
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Container>
      </Section>
    </>
  );
}
